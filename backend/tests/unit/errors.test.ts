import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ConflictError,
  toErrorResponse,
  UnauthenticatedError,
} from "../../src/shared/errors.js";

describe("error mapping", () => {
  it("preserves stable application error codes and status", () => {
    expect(toErrorResponse(new ConflictError())).toEqual({
      statusCode: 409,
      body: {
        error: {
          code: "CONFLICT",
          message: "The command conflicts with existing state",
        },
      },
    });
  });

  it("maps malformed body errors and hides unexpected details", () => {
    expect(toErrorResponse({ statusCode: 413 })).toMatchObject({
      statusCode: 413,
    });
    expect(toErrorResponse({ statusCode: 429 }).body.error.code).toBe(
      "RATE_LIMITED",
    );
    expect(toErrorResponse(new Error("private database password"))).toEqual({
      statusCode: 500,
      body: {
        error: { code: "INTERNAL", message: "An unexpected error occurred" },
      },
    });
    expect(toErrorResponse(new UnauthenticatedError()).statusCode).toBe(401);
    const invalidInput = z.string().safeParse(1);
    expect(invalidInput.success).toBe(false);
    if (!invalidInput.success) {
      expect(toErrorResponse(invalidInput.error)).toMatchObject({
        statusCode: 400,
        body: {
          error: {
            code: "INVALID_REQUEST",
            message: "The request is invalid",
          },
        },
      });
    }
  });
});
