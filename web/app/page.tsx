import Link from "next/link"
import { ArrowRight, Zap } from "lucide-react"
import Navbar from "./components/navbar"

export default function Home() {
  return (
    <>
      {/* Page content */}
      <div className="absolute top-0 left-0 w-screen h-screen flex flex-col">
        
        
        {/* Hero (fills the remaining space) */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center pt-24 md:pt-32">
          <h1 className="text-display-xl text-neutral mb-6">
            Accelerate Your
            <span className="text-primary"> Documentation </span>
            Workflow
          </h1>
      
          <p className="text-body-xl text-neutral mb-8 max-w-2xl">
            Transform your document workflows with intelligent processing and seamless integration.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/register"
              className="bg-primary text-white px-8 py-4 rounded-full text-body-lg font-medium hover:bg-opacity-90 transition-all duration-200 flex items-center space-x-2"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

          </div>
        </main>
      </div>
    </>
  )
}
