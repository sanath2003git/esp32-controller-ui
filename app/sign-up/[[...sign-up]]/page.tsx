import { SignUp } from "@clerk/nextjs";
import { Bot } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* RoboToy Controller Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/40 shadow-[0_0_24px_rgba(124,92,255,0.35)] mb-3">
            <Bot size={30} className="text-accent" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            RoboToy Controller
          </h1>
          <p className="mt-1 text-xs text-white/60 max-w-xs leading-relaxed">
            Create your account to pair with your ESP32 controller and start controlling your robot.
          </p>
        </div>

        {/* Clerk Sign Up Card */}
        <div className="w-full flex justify-center">
          <SignUp
            appearance={{
              elements: {
                card: "bg-surface border border-border shadow-[0_24px_80px_rgba(0,0,0,0.4)] rounded-3xl w-full",
                headerTitle: "text-foreground font-black text-xl",
                headerSubtitle: "text-white/60 text-xs",
                socialButtonsBlockButton: "bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl",
                formButtonPrimary: "bg-primary hover:bg-primary/90 text-white font-bold rounded-xl py-2.5 shadow-[0_4px_16px_rgba(124,92,255,0.4)] transition",
                footerActionLink: "text-accent hover:underline",
                formFieldInput: "bg-background border border-border text-foreground rounded-xl focus:border-primary",
                identityPreviewText: "text-white/80",
                identityPreviewEditButtonIcon: "text-accent",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
