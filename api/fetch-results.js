export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { eventId, classId } = req.body;

  try {
    // Fetch results from ORC website
    const orcUrl = `https://data.orc.org/public/WEV.dll?action=series&eventid=${eventId}&classid=${classId}`;
    
    console.log('Fetching from:', orcUrl);
    
    const response = await fetch(orcUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`ORC API returned ${response.status}`);
    }

    const html = await response.text();
    
    // Parse the HTML to extract race results
    const results = parseORCResults(html);
    
    console.log(`Parsed ${results.length} results`);
    
    return res.status(200).json({
      success: true,
      results: results,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching ORC results:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch results from ORC',
      error: error.message
    });
  }
}

function parseORCResults(html) {
  const results = [];
  
  try {
    // Extract table data from HTML - this is a simplified parser
    // The ORC results come in a table format
    
    // Look for table rows with race data
    const tableRowRegex = /<tr[^>]*>.*?<\/tr>/gis;
    const matches = html.match(tableRowRegex);
    
    if (!matches) {
      console.log('No table rows found in HTML');
      return results;
    }

    for (const row of matches) {
      // Extract cell data from each row
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        // Clean HTML tags and whitespace
        const cellText = cellMatch[1].replace(/<[^>]*>/g, '').trim();
        cells.push(cellText);
      }
      
      // Skip header rows and empty rows
      if (cells.length >= 4 && cells[0] && !isNaN(parseInt(cells[0]))) {
        results.push({
          position: cells[0],
          name: cells[1] || 'Unknown',
          sailNo: cells[2] || '',
          club: cells[3] || '',
          skipper: cells[4] || '',
          points: cells[5] || '0',
          total: cells[6] || cells[5] || '0'
        });
      }
    }
    
  } catch (error) {
    console.error('Error parsing ORC results:', error);
  }
  
  return results;
}
