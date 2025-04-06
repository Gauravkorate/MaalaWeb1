/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * @param lat1 Latitude of first point in degrees
 * @param lon1 Longitude of first point in degrees
 * @param lat2 Latitude of second point in degrees
 * @param lon2 Longitude of second point in degrees
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get the bounding box coordinates for a given point and radius
 * @param latitude Center point latitude
 * @param longitude Center point longitude
 * @param radius Radius in kilometers
 * @returns Bounding box coordinates
 */
export function getBoundingBox(
  latitude: number,
  longitude: number,
  radius: number
): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  const R = 6371; // Earth's radius in kilometers

  // Angular radius in radians
  const radDist = radius / R;

  const radLat = toRad(latitude);
  const radLon = toRad(longitude);

  const minLat = radLat - radDist;
  const maxLat = radLat + radDist;

  let minLon, maxLon;

  if (minLat > -Math.PI / 2 && maxLat < Math.PI / 2) {
    const deltaLon = Math.asin(Math.sin(radDist) / Math.cos(radLat));
    minLon = radLon - deltaLon;
    maxLon = radLon + deltaLon;

    if (minLon < -Math.PI) {
      minLon += 2 * Math.PI;
    }
    if (maxLon > Math.PI) {
      maxLon -= 2 * Math.PI;
    }
  } else {
    // Near the poles
    minLat = Math.max(minLat, -Math.PI / 2);
    maxLat = Math.min(maxLat, Math.PI / 2);
    minLon = -Math.PI;
    maxLon = Math.PI;
  }

  return {
    minLat: toDegrees(minLat),
    maxLat: toDegrees(maxLat),
    minLon: toDegrees(minLon),
    maxLon: toDegrees(maxLon),
  };
}

/**
 * Convert radians to degrees
 * @param radians Angle in radians
 * @returns Angle in degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Check if a point is within a given radius of another point
 * @param pointLat Latitude of the point to check
 * @param pointLon Longitude of the point to check
 * @param centerLat Latitude of the center point
 * @param centerLon Longitude of the center point
 * @param radius Radius in kilometers
 * @returns True if the point is within the radius
 */
export function isWithinRadius(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radius: number
): boolean {
  return calculateDistance(pointLat, pointLon, centerLat, centerLon) <= radius;
}

/**
 * Get the approximate city/region name from coordinates using reverse geocoding
 * @param latitude Latitude of the point
 * @param longitude Longitude of the point
 * @returns Promise resolving to the city/region name
 */
export async function getLocationName(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
    );
    const data = await response.json();
    return (
      data.address.city ||
      data.address.town ||
      data.address.village ||
      "Unknown Location"
    );
  } catch (error) {
    console.error("Error getting location name:", error);
    return "Unknown Location";
  }
}

/**
 * Calculate the delivery time estimate based on distance
 * @param distance Distance in kilometers
 * @returns Estimated delivery time in minutes
 */
export function calculateDeliveryTime(distance: number): number {
  // Base time of 30 minutes plus 2 minutes per kilometer
  return Math.round(30 + distance * 2);
}

/**
 * Get the delivery cost based on distance and seller preferences
 * @param distance Distance in kilometers
 * @param freeDeliveryRadius Radius for free delivery in kilometers
 * @param baseDeliveryCost Base delivery cost in INR
 * @returns Delivery cost in INR
 */
export function calculateDeliveryCost(
  distance: number,
  freeDeliveryRadius: number,
  baseDeliveryCost: number = 50
): number {
  if (distance <= freeDeliveryRadius) {
    return 0;
  }
  return baseDeliveryCost + Math.round((distance - freeDeliveryRadius) * 5);
}

/**
 * Calculate the optimal delivery route between multiple points
 * @param points Array of coordinates to visit
 * @returns Array of coordinates in optimal order
 */
export function calculateOptimalRoute(
  points: { latitude: number; longitude: number }[]
): { latitude: number; longitude: number }[] {
  if (points.length <= 2) return points;

  // Implement nearest neighbor algorithm for route optimization
  const route: { latitude: number; longitude: number }[] = [];
  const unvisited = [...points];

  // Start with the first point
  let current = unvisited.shift()!;
  route.push(current);

  while (unvisited.length > 0) {
    // Find the nearest unvisited point
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const distance = calculateDistance(
        current.latitude,
        current.longitude,
        unvisited[i].latitude,
        unvisited[i].longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    // Add the nearest point to the route
    current = unvisited[nearestIndex];
    route.push(current);
    unvisited.splice(nearestIndex, 1);
  }

  return route;
}

/**
 * Calculate the total distance of a route
 * @param route Array of coordinates in the route
 * @returns Total distance in kilometers
 */
export function calculateRouteDistance(
  route: { latitude: number; longitude: number }[]
): number {
  let totalDistance = 0;

  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += calculateDistance(
      route[i].latitude,
      route[i].longitude,
      route[i + 1].latitude,
      route[i + 1].longitude
    );
  }

  return totalDistance;
}

/**
 * Get the estimated delivery time for a route
 * @param route Array of coordinates in the route
 * @param averageSpeed Average delivery speed in km/h
 * @returns Estimated delivery time in minutes
 */
export function calculateRouteDeliveryTime(
  route: { latitude: number; longitude: number }[],
  averageSpeed: number = 30
): number {
  const distance = calculateRouteDistance(route);
  return Math.round((distance / averageSpeed) * 60);
}

/**
 * Get the time zone for a given location
 * @param latitude Latitude of the point
 * @param longitude Longitude of the point
 * @returns Promise resolving to the time zone
 */
export async function getTimeZone(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const response = await fetch(
      `https://api.timezonedb.com/v2.1/get-time-zone?key=${process.env.TIMEZONE_API_KEY}&format=json&by=position&lat=${latitude}&lng=${longitude}`
    );
    const data = await response.json();
    return data.zoneName || "UTC";
  } catch (error) {
    console.error("Error getting time zone:", error);
    return "UTC";
  }
}

/**
 * Check if a location is within business hours
 * @param latitude Latitude of the point
 * @param longitude Longitude of the point
 * @param workingHours Business working hours
 * @returns Promise resolving to whether the location is open
 */
export async function isWithinBusinessHours(
  latitude: number,
  longitude: number,
  workingHours: { start: string; end: string; days: number[] }
): Promise<boolean> {
  try {
    const timeZone = await getTimeZone(latitude, longitude);
    const now = new Date();
    const localTime = new Date(now.toLocaleString("en-US", { timeZone }));

    const currentDay = localTime.getDay();
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();

    const [startHour, startMinute] = workingHours.start.split(":").map(Number);
    const [endHour, endMinute] = workingHours.end.split(":").map(Number);

    const isWorkingDay = workingHours.days.includes(currentDay);
    const isWithinHours =
      (currentHour > startHour ||
        (currentHour === startHour && currentMinute >= startMinute)) &&
      (currentHour < endHour ||
        (currentHour === endHour && currentMinute <= endMinute));

    return isWorkingDay && isWithinHours;
  } catch (error) {
    console.error("Error checking business hours:", error);
    return false;
  }
}

/**
 * Calculate the carbon footprint for a delivery route
 * @param distance Distance in kilometers
 * @param vehicleType Type of delivery vehicle
 * @returns Carbon footprint in kg CO2
 */
export function calculateCarbonFootprint(
  distance: number,
  vehicleType: "bicycle" | "motorcycle" | "car" | "truck" = "motorcycle"
): number {
  const emissionFactors = {
    bicycle: 0,
    motorcycle: 0.12,
    car: 0.2,
    truck: 0.3,
  };

  return distance * emissionFactors[vehicleType];
}

/**
 * Get the weather conditions for a location
 * @param latitude Latitude of the point
 * @param longitude Longitude of the point
 * @returns Promise resolving to weather information
 */
export async function getWeatherConditions(
  latitude: number,
  longitude: number
): Promise<{
  temperature: number;
  conditions: string;
  isDeliveryFriendly: boolean;
}> {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${process.env.WEATHER_API_KEY}&units=metric`
    );
    const data = await response.json();

    const temperature = data.main.temp;
    const conditions = data.weather[0].main;
    const isDeliveryFriendly = !["Thunderstorm", "Heavy Rain", "Snow"].includes(
      conditions
    );

    return {
      temperature,
      conditions,
      isDeliveryFriendly,
    };
  } catch (error) {
    console.error("Error getting weather conditions:", error);
    return {
      temperature: 0,
      conditions: "Unknown",
      isDeliveryFriendly: true,
    };
  }
}

/**
 * List of major Indian languages with their ISO codes
 */
export const INDIAN_LANGUAGES = {
  hindi: { code: "hi", name: "हिंदी" },
  bengali: { code: "bn", name: "বাংলা" },
  telugu: { code: "te", name: "తెలుగు" },
  marathi: { code: "mr", name: "मराठी" },
  tamil: { code: "ta", name: "தமிழ்" },
  gujarati: { code: "gu", name: "ગુજરાતી" },
  urdu: { code: "ur", name: "اردو" },
  kannada: { code: "kn", name: "ಕನ್ನಡ" },
  odia: { code: "or", name: "ଓଡ଼ିଆ" },
  malayalam: { code: "ml", name: "മലയാളം" },
  punjabi: { code: "pa", name: "ਪੰਜਾਬੀ" },
  assamese: { code: "as", name: "অসমীয়া" },
  maithili: { code: "mai", name: "मैथिली" },
  santali: { code: "sat", name: "ᱥᱟᱱᱛᱟᱲᱤ" },
  nepali: { code: "ne", name: "नेपाली" },
  konkani: { code: "kok", name: "कोंकणी" },
  dogri: { code: "doi", name: "डोगरी" },
  manipuri: { code: "mni", name: "ꯃꯤꯇꯩꯂꯣꯟ" },
  bodo: { code: "brx", name: "बड़ो" },
  sanskrit: { code: "sa", name: "संस्कृतम्" },
  sindhi: { code: "sd", name: "سنڌي" },
  english: { code: "en", name: "English" },
} as const;

/**
 * Get the primary languages spoken in a region
 * @param latitude Latitude of the point
 * @param longitude Longitude of the point
 * @returns Promise resolving to array of language codes
 */
export async function getRegionalLanguages(
  latitude: number,
  longitude: number
): Promise<string[]> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
    );
    const data = await response.json();

    // Map of Indian states/regions to their primary languages
    const regionLanguageMap: { [key: string]: string[] } = {
      "Andhra Pradesh": ["te", "en"],
      "Arunachal Pradesh": ["en", "hi"],
      Assam: ["as", "bn", "en"],
      Bihar: ["hi", "mai", "en"],
      Chhattisgarh: ["hi", "en"],
      Goa: ["kok", "mr", "en"],
      Gujarat: ["gu", "en"],
      Haryana: ["hi", "en"],
      "Himachal Pradesh": ["hi", "en"],
      Jharkhand: ["hi", "en"],
      Karnataka: ["kn", "en"],
      Kerala: ["ml", "en"],
      "Madhya Pradesh": ["hi", "en"],
      Maharashtra: ["mr", "en"],
      Manipur: ["mni", "en"],
      Meghalaya: ["en"],
      Mizoram: ["en"],
      Nagaland: ["en"],
      Odisha: ["or", "en"],
      Punjab: ["pa", "en"],
      Rajasthan: ["hi", "en"],
      Sikkim: ["ne", "en"],
      "Tamil Nadu": ["ta", "en"],
      Telangana: ["te", "en"],
      Tripura: ["bn", "en"],
      "Uttar Pradesh": ["hi", "ur", "en"],
      Uttarakhand: ["hi", "en"],
      "West Bengal": ["bn", "en"],
      Delhi: ["hi", "en"],
      "Jammu and Kashmir": ["ur", "doi", "en"],
      Ladakh: ["ur", "doi", "en"],
      Puducherry: ["ta", "fr", "en"],
      "Andaman and Nicobar Islands": ["hi", "en"],
      Chandigarh: ["pa", "hi", "en"],
      "Dadra and Nagar Haveli and Daman and Diu": ["gu", "mr", "en"],
      Lakshadweep: ["ml", "en"],
    };

    const state = data.address.state || data.address.region;
    return regionLanguageMap[state] || ["hi", "en"]; // Default to Hindi and English if region not found
  } catch (error) {
    console.error("Error getting regional languages:", error);
    return ["hi", "en"]; // Default to Hindi and English on error
  }
}

/**
 * Get location name in multiple Indian languages
 * @param latitude Latitude of the point
 * @param longitude Longitude of the point
 * @returns Promise resolving to location names in different languages
 */
export async function getLocationNamesInLanguages(
  latitude: number,
  longitude: number
): Promise<{ [key: string]: string }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=${Object.values(
        INDIAN_LANGUAGES
      )
        .map((lang) => lang.code)
        .join(",")}`
    );
    const data = await response.json();

    const locationNames: { [key: string]: string } = {};
    const address = data.address;

    // Get the most specific location name available
    const locationName =
      address.city ||
      address.town ||
      address.village ||
      address.state ||
      "Unknown Location";

    // Map of language codes to their display names
    const languageNames = Object.entries(INDIAN_LANGUAGES).reduce(
      (acc, [key, value]) => {
        acc[value.code] = value.name;
        return acc;
      },
      {} as { [key: string]: string }
    );

    // Add the location name in each language
    Object.keys(languageNames).forEach((langCode) => {
      locationNames[langCode] = locationName;
    });

    return locationNames;
  } catch (error) {
    console.error("Error getting location names in languages:", error);
    return { en: "Unknown Location", hi: "अज्ञात स्थान" };
  }
}

/**
 * Get business hours in local language format
 * @param workingHours Business working hours
 * @param languageCode Language code (default: 'en')
 * @returns Formatted working hours string
 */
export function formatWorkingHours(
  workingHours: { start: string; end: string; days: number[] },
  languageCode: string = "en"
): string {
  const dayNames = {
    en: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    hi: [
      "रविवार",
      "सोमवार",
      "मंगलवार",
      "बुधवार",
      "गुरुवार",
      "शुक्रवार",
      "शनिवार",
    ],
    bn: [
      "রবিবার",
      "সোমবার",
      "মঙ্গলবার",
      "বুধবার",
      "বৃহস্পতিবার",
      "শুক্রবার",
      "শনিবার",
    ],
    te: [
      "ఆదివారం",
      "సోమవారం",
      "మంగళవారం",
      "బుధవారం",
      "గురువారం",
      "శుక్రవారం",
      "శనివారం",
    ],
    mr: [
      "रविवार",
      "सोमवार",
      "मंगळवार",
      "बुधवार",
      "गुरुवार",
      "शुक्रवार",
      "शनिवार",
    ],
    ta: ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"],
    gu: [
      "રવિવાર",
      "સોમવાર",
      "મંગળવાર",
      "બુધવાર",
      "ગુરુવાર",
      "શુક્રવાર",
      "શનિવાર",
    ],
    kn: [
      "ಭಾನುವಾರ",
      "ಸೋಮವಾರ",
      "ಮಂಗಳವಾರ",
      "ಬುಧವಾರ",
      "ಗುರುವಾರ",
      "ಶುಕ್ರವಾರ",
      "ಶನಿವಾರ",
    ],
    ml: [
      "ഞായറാഴ്ച",
      "തിങ്കളാഴ്ച",
      "ചൊവ്വാഴ്ച",
      "ബുധനാഴ്ച",
      "വ്യാഴാഴ്ച",
      "വെള്ളിയാഴ്ച",
      "ശനിയാഴ്ച",
    ],
    pa: [
      "ਐਤਵਾਰ",
      "ਸੋਮਵਾਰ",
      "ਮੰਗਲਵਾਰ",
      "ਬੁੱਧਵਾਰ",
      "ਵੀਰਵਾਰ",
      "ਸ਼ੁੱਕਰਵਾਰ",
      "ਸ਼ਨੀਵਾਰ",
    ],
  };

  const days = workingHours.days.map(
    (day) =>
      dayNames[languageCode as keyof typeof dayNames]?.[day] || dayNames.en[day]
  );
  return `${days.join(", ")}: ${workingHours.start} - ${workingHours.end}`;
}

/**
 * Get delivery instructions in local language
 * @param instructions Delivery instructions
 * @param languageCode Language code (default: 'en')
 * @returns Formatted delivery instructions
 */
export function formatDeliveryInstructions(
  instructions: string,
  languageCode: string = "en"
): string {
  const instructionTemplates = {
    en: {
      leaveAtDoor: "Leave at door",
      callBeforeDelivery: "Call before delivery",
      deliverToReception: "Deliver to reception",
      handToRecipient: "Hand to recipient only",
    },
    hi: {
      leaveAtDoor: "दरवाजे पर छोड़ दें",
      callBeforeDelivery: "डिलीवरी से पहले कॉल करें",
      deliverToReception: "रिसेप्शन पर डिलीवर करें",
      handToRecipient: "केवल प्राप्तकर्ता को दें",
    },
    bn: {
      leaveAtDoor: "দরজায় রেখে যান",
      callBeforeDelivery: "ডেলিভারির আগে কল করুন",
      deliverToReception: "রিসেপশনে ডেলিভার করুন",
      handToRecipient: "শুধুমাত্র প্রাপককে দিন",
    },
    // Add more language templates as needed
  };

  return (
    instructionTemplates[languageCode as keyof typeof instructionTemplates]?.[
      instructions as keyof typeof instructionTemplates.en
    ] || instructions
  );
}
