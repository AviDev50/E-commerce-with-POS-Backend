export function maskUpi(upiId: string): string {
  const [name = "", handle = ""] = upiId.split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 2))}@${handle}`;
}