import { Router } from "express";
import crypto from "node:crypto";
import JWTHelper from "../../utility/jwt";
export const WSAccessRoute = Router().get("/wsaccess", async (req, res) => {
  // The local test stack uses one bootstrap bearer token for multiple browser
  // identities. Never enable this override in production.
  const testUserId = req.query.test_user_id;
  const allowTestIdentity =
    process.env.NODE_ENV !== "production" &&
    process.env.WS_TEST_AUTH_ENABLED === "true" &&
    typeof testUserId === "string" &&
    testUserId.trim().length > 0;
  const user_id = allowTestIdentity ? testUserId.trim() : req.user?.user_id;

  if (!user_id) {
    return res
      .status(400)
      .json({ success: false, message: "The user id not found!", error: true });
  }
  try {
    const jti = crypto.randomUUID();
    const token = await JWTHelper.sign(
      { user_id },
      "2m",
      process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
      jti,
    );

    res.cookie("ws_access", token, {
      httpOnly: true,
      secure: process.env.HTTPS_ENABLED === "true",
      sameSite: "strict",
      path: "/",
      maxAge: 2 * 60 * 1000,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to issue WebSocket access cookie:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to issue WebSocket access cookie",
      error: true,
    });
  }
});
