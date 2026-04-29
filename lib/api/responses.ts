import { NextResponse } from "next/server"

export type ApiSuccess<T> = {
  ok: true
  data: T
}

export type ApiError = {
  ok: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export function apiError<TData = unknown>(
  status: number,
  code: string,
  message: string
): NextResponse<ApiResponse<TData>> {
  return NextResponse.json<ApiResponse<TData>>(
    {
      ok: false,
      error: { code, message },
    },
    { status }
  )
}
