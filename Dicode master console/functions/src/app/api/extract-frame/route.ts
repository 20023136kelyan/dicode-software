export async function POST(request: Request) {
    return Response.json(
        {
            error: {
                message: "Frame extraction is currently unavailable."
            }
        },
        { status: 501 }
    );
}
