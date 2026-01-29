import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Link href="/" className="inline-block mb-4">
            <span className="text-3xl font-bold text-primary-600">SeatIQ</span>
          </Link>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">
            A magic link has been sent to your email address.
          </p>
          <p className="text-sm text-gray-500">
            Click the link in your email to sign in. The link will expire in 24 hours.
          </p>
          <p className="mt-6 text-xs text-gray-400">
            <strong>Development mode:</strong> Check your terminal/console for the magic link URL.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
