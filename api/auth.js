export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Get credentials from environment variables
  const validUsername = process.env.SAILING_USERNAME;
  const validPassword = process.env.SAILING_PASSWORD;

  if (!validUsername || !validPassword) {
    return res.status(500).json({ 
      success: false, 
      message: 'Server configuration error - credentials not set' 
    });
  }

  if (username === validUsername && password === validPassword) {
    return res.status(200).json({ 
      success: true, 
      username: username,
      message: 'Authentication successful' 
    });
  } else {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid username or password' 
    });
  }
}
