"use server";

import { TokenFormSchema } from "@/lib/schemas";

export type ActionState = {
  success: boolean;
  message?: string;
  data?: any[];
  errors?: {
    token?: string[];
  };
};

export async function fetchLotteryData(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let token = formData.get("token")?.toString();

  // The user rule specifically allows "Authorization : Bearer xyz token",
  // so if token contains "Bearer ", we strip it just to use the raw token.
  if (token && token.startsWith("Bearer ")) {
    token = token.replace("Bearer ", "").trim();
  }

  const validatedFields = TokenFormSchema.safeParse({ token });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Please fix the form errors.",
    };
  }

  try {
    const res = await fetch("https://phitronuat.jsdude.com/api/eid-card", {
      headers: {
        Authorization: `Bearer ${validatedFields.data.token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: "Unauthorized: Invalid or expired token." };
      }
      return { success: false, message: `Failed to fetch data. Status: ${res.status} ${res.statusText}` };
    }

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { success: false, message: "API did not return valid JSON." };
    }
    
    // Check if the response matches any common structure
    let dataList = Array.isArray(json) ? json : json.data || json.result || json.items || json.records;
    
    if (!Array.isArray(dataList)) {
      return { success: false, message: "Invalid data format received from API. Expected an array." };
    }

    if (dataList.length === 0) {
      return { success: false, message: "The database is empty." };
    }

    // Deduplicate data before returning to eliminate multiple entries from the same phone number
    const uniqueDataList = [];
    const phoneSet = new Set<string>();

    for (const item of dataList) {
      if (!item) continue;
      
      const phone = item.phone || item.phoneNumber || item.mobile || item.contact || item.contactNumber || item.mobileNumber || item.phone_number;
      
      if (phone) {
        const phoneStr = String(phone).trim();
        // Remove non-digit characters for a robust check (e.g., matching '+880' vs '0880' vs '0')
        // We will just remove dashes and spaces to match variations like "017 123" and "017123"
        // Better yet, remove all non-digits:
        const digitsOnly = phoneStr.replace(/\D/g, "");
        const phoneKey = digitsOnly.length > 5 ? digitsOnly : phoneStr.toLowerCase();

        if (!phoneSet.has(phoneKey)) {
          phoneSet.add(phoneKey);
          uniqueDataList.push(item);
        }
      } else {
        // If no recognizable phone number is found, include the item anyway
        uniqueDataList.push(item);
      }
    }

    return { success: true, data: uniqueDataList, message: "Data fetched successfully!" };

  } catch (error) {
    console.error("Fetch Error:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
}
