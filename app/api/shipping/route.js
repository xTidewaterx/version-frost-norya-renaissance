export async function POST(request) {
  try {

    console.log(request)
    const shippingData = await request.json();

    const placeholderUrl = 'https://jsonplaceholder.typicode.com/posts';

    const response = await fetch(placeholderUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shippingData),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to forward shipping request' }),
        { status: response.status }
      );
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Shipping request forwarded successfully',
        specialMessage: 'confirmation, data comes from backend endpoint handler',
        data: result,
      }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500 }
    );
  }
}
