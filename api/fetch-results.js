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

  const { eventId, classId, raceId } = req.body;

  try {
    let orcUrl;
    if (raceId) {
      // Individual race results with corrected times
      orcUrl = `https://data.orc.org/public/WEV.dll?action=race&eventid=${eventId}&raceid=${raceId}`;
    } else {
      // Overall series standings
      orcUrl = `https://data.orc.org/public/WEV.dll?action=series&eventid=${eventId}&classid=${classId}`;
    }
    
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
    
    // Parse the HTML based on result type
    const results = raceId ? parseRaceResults(html) : parseOverallResults(html);
    
    console.log(`Parsed ${results.length} results`);
    
    return res.status(200).json({
      success: true,
      results: results,
      resultType: raceId ? 'race' : 'overall',
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

function parseOverallResults(html) {
  const results = [];
  
  try {
    // Parse overall series standings table
    const tableRowRegex = /<tr[^>]*>.*?<\/tr>/gis;
    const matches = html.match(tableRowRegex);
    
    if (!matches) {
      console.log('No table rows found in overall results');
      return results;
    }

    for (const row of matches) {
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
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
    console.error('Error parsing overall results:', error);
  }
  
  return results;
}

function parseRaceResults(html) {
  const results = [];
  
  try {
    // Parse individual race results table with corrected times
    const tableRowRegex = /<tr[^>]*>.*?<\/tr>/gis;
    const matches = html.match(tableRowRegex);
    
    if (!matches) {
      console.log('No table rows found in race results');
      return results;
    }

    for (const row of matches) {
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        const cellText = cellMatch[1].replace(/<[^>]*>/g, '').trim();
        cells.push(cellText);
      }
      
      // Race results have: Pos, Name, Sail No, Skipper, Finish Time, Elapsed, Corrected, Penalty, Points
      if (cells.length >= 6 && cells[0] && !isNaN(parseInt(cells[0]))) {
        results.push({
          position: cells[0],
          name: cells[1] || 'Unknown',
          sailNo: cells[2] || '',
          skipper: cells[3] || '',
          finishTime: cells[4] || '',
          elapsed: cells[5] || '',
          correctedTime: cells[6] || '',
          penalty: cells[7] || '0',
          points: cells[8] || '0'
        });
      }
      
      // Handle DNF entries which have fewer columns
      else if (cells.length >= 3 && cells[0] && !isNaN(parseInt(cells[0])) && cells[4] === 'DNF') {
        results.push({
          position: cells[0],
          name: cells[1] || 'Unknown',
          sailNo: cells[2] || '',
          skipper: cells[3] || '',
          finishTime: 'DNF',
          elapsed: 'DNF',
          correctedTime: 'DNF',
          penalty: '0',
          points: cells[5] || '6.00'
        });
      }
    }
    
  } catch (error) {
    console.error('Error parsing race results:', error);
  }
  
  return results;
}
