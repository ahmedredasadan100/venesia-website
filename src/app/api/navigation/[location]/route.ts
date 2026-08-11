import { NextResponse } from "next/server";
import { getPublicNavigationSnapshot } from "../../../../lib/navigation/get-public-navigation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ location: string }> },
) {
  const { location: locationParam } = await params;
  const location = locationParam || "main";
  const snapshot = await getPublicNavigationSnapshot(location);

  return NextResponse.json({
    source: "database",
    ...(snapshot.menu ? { menu: snapshot.menu } : {}),
    items: snapshot.items,
  });
}
