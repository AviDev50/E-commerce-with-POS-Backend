// req.params ki value TS mein `string | string[]` typed hoti hai (kuch route
// patterns array bhi de sakte hain), lekin humare simple `/:id` routes mein
// runtime pe hamesha string hi aata hai — ye helper us gap ko safely narrow karta hai
export function getParam(value: string | string[] | undefined, name = "id"): string {
  if (typeof value !== "string" || value.length === 0) {
    const error: any = new Error(`Invalid or missing route parameter: ${name}`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}