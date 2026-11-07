import { UserPayload } from "../server/app/types/user.payload";
import * as jose from "jose";
import crypto from "node:crypto";

export default (() => {
  return {
    async verify(jwtToken: string, publicKey: string): Promise<UserPayload> {
      const key = await jose.importSPKI(publicKey, "RS256");

      const { payload } = await jose.jwtVerify(jwtToken, key, {
        algorithms: ["RS256"],
      });

      return payload as UserPayload;
    },

    async sign(
      payload: UserPayload,
      exp: string,
      privateKey: string,
    ): Promise<string> {
      const key = await jose.importPKCS8(privateKey, "RS256");

      return await new jose.SignJWT(payload)
        .setProtectedHeader({
          alg: "RS256",
        })
        .setIssuedAt()
        .setJti(crypto.randomUUID())
        .setExpirationTime(exp)
        .sign(key);
    },
  };
})();
