import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/mongodb";

export async function POST() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const primaryEmail =
      user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "";

    try {
      const db = await getDatabase();
      const usersCollection = db.collection("users");

      await usersCollection.updateOne(
        { clerkId: user.id },
        {
          $set: {
            clerkId: user.id,
            email: primaryEmail,
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            imageUrl: user.imageUrl ?? "",
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (dbErr) {
      console.warn("[USER SYNC] MongoDB Atlas database write skipped or failed:", dbErr);
      return NextResponse.json({
        success: true,
        syncedToDb: false,
        warning: "MongoDB Atlas unreachable or invalid placeholder URI",
        user: {
          id: user.id,
          email: primaryEmail,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    }

    return NextResponse.json({
      success: true,
      syncedToDb: true,
      user: {
        id: user.id,
        email: primaryEmail,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("[USER SYNC ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
