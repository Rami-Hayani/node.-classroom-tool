import { NextRequest, NextResponse } from "next/server";
import { flaskPut } from "@/lib/flask";
import { emitToLectureRoom } from "@server/socket-helpers";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  try {
    const lecture = await flaskPut(`/api/lectures/${id}`, body);
    if (body.status === "ended") {
      emitToLectureRoom(id, "lecture:ended", { lectureId: id });
    }
    return NextResponse.json(lecture);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update lecture" },
      { status: 500 },
    );
  }
}
