import {
  handleAdminLoginRequest,
  handleUnexpectedAdminLoginError,
} from "../../../../../lib/admin/auth/handle-admin-login";

export async function POST(request: Request) {
  try {
    return await handleAdminLoginRequest(request);
  } catch (error) {
    return handleUnexpectedAdminLoginError(error, "/api/admin/auth/login");
  }
}
