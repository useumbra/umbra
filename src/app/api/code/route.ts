export function GET() {
  return Response.json({
    model: "qwen-coder",
    stub: !process.env.OPENROUTER_API_KEY,
  });
}
