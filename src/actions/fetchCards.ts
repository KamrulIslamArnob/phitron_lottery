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

    // Attempt to map or just pass the objects.
    // If objects are complex, we might want to just keep them as is and let the client figure it out.
    return { success: true, data: dataList, message: "Data fetched successfully!" };

  } catch (error) {
    console.error("Fetch Error:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
}
