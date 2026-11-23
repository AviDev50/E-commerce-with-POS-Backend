export async function sendOtpViaIndopay(
  mobile: string,
  digits: 4 | 6,
): Promise<string> {
  const url = new URL("https://indopay.cloud/otp/newsend_otp.php");
  url.searchParams.set("merchant_key", process.env.INDOPAY_MERCHANT_KEY as string);
  url.searchParams.set("mobile_no", mobile);
  url.searchParams.set("digit", String(digits));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const json: any = await res.json();

    if (json.status !== "success" || !json.otp) {
      // URL log mat karna — usme merchant_key hai
      console.error("[indopay] send failed:", json.error, json.msg, json.remaining);
      const err: any = new Error("Unable to send OTP right now. Please try again later.");
      err.statusCode = 502;
      throw err;
    }

    if (typeof json.remaining === "number" && json.remaining < 50) {
      console.warn(`[indopay] low OTP credits: ${json.remaining}`);
    }

    return String(json.otp);
  } catch (e: any) {
    if (e.statusCode) throw e;
    console.error("[indopay] request error:", e.name);
    const err: any = new Error("Unable to send OTP right now. Please try again later.");
    err.statusCode = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}