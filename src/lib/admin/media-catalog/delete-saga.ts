export type MediaDeleteReservation = {
  id: string;
  assetId: string;
  publicValue: string;
  startedAt: string;
};

export type MediaDeletePostReservationScan = {
  referenceReasons: string[];
  uncertainties: string[];
};

export type MediaDeleteStorageState = "exists" | "missing" | "uncertain";

export type MediaDeleteSagaFailure = {
  deleted: false;
  code:
    | "media_delete_post_reservation_reference"
    | "media_delete_post_reservation_scan_failed"
    | "media_delete_storage_failed"
    | "media_delete_finalization_failed";
  stage: "post_reservation_scan" | "storage_delete" | "finalization";
  reservation: MediaDeleteReservation;
  reasons: string[];
  recoveryState: "active" | "deleting" | "missing";
  repairRequired: boolean;
};

export type MediaDeleteSagaSuccess<TResult> = {
  deleted: true;
  code: "media_delete_completed";
  reservation: MediaDeleteReservation;
  storageResult: TResult;
};

export type MediaDeleteSagaDependencies<TResult> = {
  reserve(): Promise<MediaDeleteReservation>;
  scanAfterReservation(): Promise<MediaDeletePostReservationScan>;
  deleteStorage(reservation: MediaDeleteReservation): Promise<TResult>;
  verifyStorageState(reservation: MediaDeleteReservation): Promise<MediaDeleteStorageState>;
  cancelReservation(input: {
    reservation: MediaDeleteReservation;
    failureCode: string;
    reasons: string[];
    storageVerifiedAt: string;
  }): Promise<void>;
  finalizeReservation(input: {
    reservation: MediaDeleteReservation;
    storageVerifiedAt: string;
  }): Promise<void>;
  markRecoveryRequired(input: {
    reservation: MediaDeleteReservation;
    failureCode: string;
    reasons: string[];
    storageState: Exclude<MediaDeleteStorageState, "exists">;
    storageVerifiedAt: string | null;
  }): Promise<void>;
};

function errorReason(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function cancelBeforeStorage<TResult>(
  dependencies: MediaDeleteSagaDependencies<TResult>,
  reservation: MediaDeleteReservation,
  failureCode: MediaDeleteSagaFailure["code"],
  reasons: string[],
): Promise<MediaDeleteSagaFailure> {
  let storageState: MediaDeleteStorageState = "uncertain";
  let storageVerifiedAt: string | null = null;
  try {
    storageState = await dependencies.verifyStorageState(reservation);
    storageVerifiedAt = new Date().toISOString();
  } catch (verificationError) {
    reasons.push(
      `media_delete_storage_verification_failed:${errorReason(verificationError, "unknown")}`,
    );
  }

  if (storageState !== "exists") {
    try {
      await dependencies.markRecoveryRequired({
        reservation,
        failureCode,
        reasons,
        storageState,
        storageVerifiedAt,
      });
      return {
        deleted: false,
        code: failureCode,
        stage: "post_reservation_scan",
        reservation,
        reasons,
        recoveryState: storageState === "missing" ? "missing" : "deleting",
        repairRequired: true,
      };
    } catch (recoveryError) {
      return {
        deleted: false,
        code: failureCode,
        stage: "post_reservation_scan",
        reservation,
        reasons: [
          ...reasons,
          `media_delete_recovery_mark_failed:${errorReason(recoveryError, "unknown")}`,
        ],
        recoveryState: "deleting",
        repairRequired: true,
      };
    }
  }

  try {
    await dependencies.cancelReservation({
      reservation,
      failureCode,
      reasons,
      storageVerifiedAt: storageVerifiedAt ?? new Date().toISOString(),
    });
    return {
      deleted: false,
      code: failureCode,
      stage: "post_reservation_scan",
      reservation,
      reasons,
      recoveryState: "active",
      repairRequired: false,
    };
  } catch (compensationError) {
    return {
      deleted: false,
      code: failureCode,
      stage: "post_reservation_scan",
      reservation,
      reasons: [
        ...reasons,
        `media_delete_compensation_failed:${errorReason(compensationError, "unknown")}`,
      ],
      recoveryState: "deleting",
      repairRequired: true,
    };
  }
}

export async function runMediaDeleteSaga<TResult>(
  dependencies: MediaDeleteSagaDependencies<TResult>,
): Promise<MediaDeleteSagaSuccess<TResult> | MediaDeleteSagaFailure> {
  const reservation = await dependencies.reserve();

  let postReservationScan: MediaDeletePostReservationScan;
  try {
    postReservationScan = await dependencies.scanAfterReservation();
  } catch (scanError) {
    return cancelBeforeStorage(
      dependencies,
      reservation,
      "media_delete_post_reservation_scan_failed",
      [errorReason(scanError, "media_delete_post_reservation_scan_failed")],
    );
  }

  const scanReasons = [
    ...postReservationScan.referenceReasons,
    ...postReservationScan.uncertainties,
  ];
  if (scanReasons.length) {
    return cancelBeforeStorage(
      dependencies,
      reservation,
      postReservationScan.referenceReasons.length
        ? "media_delete_post_reservation_reference"
        : "media_delete_post_reservation_scan_failed",
      scanReasons,
    );
  }

  let storageResult: TResult;
  try {
    storageResult = await dependencies.deleteStorage(reservation);
  } catch (storageError) {
    const reasons = [errorReason(storageError, "media_delete_storage_failed")];
    let storageState: MediaDeleteStorageState = "uncertain";
    let storageVerifiedAt: string | null = null;
    try {
      storageState = await dependencies.verifyStorageState(reservation);
      storageVerifiedAt = new Date().toISOString();
    } catch (verificationError) {
      reasons.push(
        `media_delete_storage_verification_failed:${errorReason(verificationError, "unknown")}`,
      );
    }

    if (storageState === "exists") {
      try {
        await dependencies.cancelReservation({
          reservation,
          failureCode: "media_delete_storage_failed",
          reasons,
          storageVerifiedAt: storageVerifiedAt ?? new Date().toISOString(),
        });
        return {
          deleted: false,
          code: "media_delete_storage_failed",
          stage: "storage_delete",
          reservation,
          reasons,
          recoveryState: "active",
          repairRequired: false,
        };
      } catch (compensationError) {
        reasons.push(
          `media_delete_compensation_failed:${errorReason(compensationError, "unknown")}`,
        );
        return {
          deleted: false,
          code: "media_delete_storage_failed",
          stage: "storage_delete",
          reservation,
          reasons,
          recoveryState: "deleting",
          repairRequired: true,
        };
      }
    }

    try {
      await dependencies.markRecoveryRequired({
        reservation,
        failureCode: "media_delete_storage_failed",
        reasons,
        storageState: storageState === "missing" ? "missing" : "uncertain",
        storageVerifiedAt,
      });
      return {
        deleted: false,
        code: "media_delete_storage_failed",
        stage: "storage_delete",
        reservation,
        reasons,
        recoveryState: storageState === "missing" ? "missing" : "deleting",
        repairRequired: true,
      };
    } catch (recoveryError) {
      reasons.push(
        `media_delete_recovery_mark_failed:${errorReason(recoveryError, "unknown")}`,
      );
      return {
        deleted: false,
        code: "media_delete_storage_failed",
        stage: "storage_delete",
        reservation,
        reasons,
        recoveryState: "deleting",
        repairRequired: true,
      };
    }
  }

  let postDeleteStorageState: MediaDeleteStorageState = "uncertain";
  let postDeleteStorageVerifiedAt: string | null = null;
  try {
    postDeleteStorageState = await dependencies.verifyStorageState(reservation);
    postDeleteStorageVerifiedAt = new Date().toISOString();
  } catch (verificationError) {
    const reasons = [
      `media_delete_storage_verification_failed:${errorReason(verificationError, "unknown")}`,
    ];
    try {
      await dependencies.markRecoveryRequired({
        reservation,
        failureCode: "media_delete_finalization_failed",
        reasons,
        storageState: "uncertain",
        storageVerifiedAt: null,
      });
    } catch (recoveryError) {
      reasons.push(`media_delete_recovery_mark_failed:${errorReason(recoveryError, "unknown")}`);
    }
    return {
      deleted: false,
      code: "media_delete_finalization_failed",
      stage: "finalization",
      reservation,
      reasons,
      recoveryState: "deleting",
      repairRequired: true,
    };
  }

  if (postDeleteStorageState === "exists") {
    const reasons = ["media_delete_storage_still_exists_after_delete"];
    try {
      await dependencies.cancelReservation({
        reservation,
        failureCode: "media_delete_storage_failed",
        reasons,
        storageVerifiedAt: postDeleteStorageVerifiedAt,
      });
      return {
        deleted: false,
        code: "media_delete_storage_failed",
        stage: "storage_delete",
        reservation,
        reasons,
        recoveryState: "active",
        repairRequired: false,
      };
    } catch (compensationError) {
      reasons.push(`media_delete_compensation_failed:${errorReason(compensationError, "unknown")}`);
      return {
        deleted: false,
        code: "media_delete_storage_failed",
        stage: "storage_delete",
        reservation,
        reasons,
        recoveryState: "deleting",
        repairRequired: true,
      };
    }
  }

  if (postDeleteStorageState !== "missing") {
    const reasons = ["media_delete_storage_absence_not_proven"];
    try {
      await dependencies.markRecoveryRequired({
        reservation,
        failureCode: "media_delete_finalization_failed",
        reasons,
        storageState: "uncertain",
        storageVerifiedAt: postDeleteStorageVerifiedAt,
      });
    } catch (recoveryError) {
      reasons.push(`media_delete_recovery_mark_failed:${errorReason(recoveryError, "unknown")}`);
    }
    return {
      deleted: false,
      code: "media_delete_finalization_failed",
      stage: "finalization",
      reservation,
      reasons,
      recoveryState: "deleting",
      repairRequired: true,
    };
  }

  try {
    await dependencies.finalizeReservation({
      reservation,
      storageVerifiedAt: postDeleteStorageVerifiedAt,
    });
  } catch (finalizationError) {
    const reasons = [errorReason(finalizationError, "media_delete_finalization_failed")];
    try {
      await dependencies.markRecoveryRequired({
        reservation,
        failureCode: "media_delete_finalization_failed",
        reasons,
        storageState: "missing",
        storageVerifiedAt: postDeleteStorageVerifiedAt,
      });
      return {
        deleted: false,
        code: "media_delete_finalization_failed",
        stage: "finalization",
        reservation,
        reasons,
        recoveryState: "missing",
        repairRequired: true,
      };
    } catch (recoveryError) {
      reasons.push(
        `media_delete_recovery_mark_failed:${errorReason(recoveryError, "unknown")}`,
      );
      return {
        deleted: false,
        code: "media_delete_finalization_failed",
        stage: "finalization",
        reservation,
        reasons,
        recoveryState: "deleting",
        repairRequired: true,
      };
    }
  }

  return {
    deleted: true,
    code: "media_delete_completed",
    reservation,
    storageResult,
  };
}
