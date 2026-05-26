import { NextResponse } from "next/server";
import { getSignalsWithOptionalXLiveMode } from "../../lib/xIngestion";

export async function GET() {
  const result = await getSignalsWithOptionalXLiveMode();

  return NextResponse.json({
    ...result,
    generatedAt: new Date().toISOString()
  });
}
