"use client";

import ErrorBoundary from "next/dist/client/components/error-boundary";
import { useState, useRef } from "react";

// Legal content moved to separate file
const TermsAndConditions = {
  generator: `
  **DFY Ad Generator Terms of Use**

  1. **Service Description**
  This tool generates advertising content suggestions based on AI. You are solely responsible for ensuring all generated content complies with platform policies.

  2. **Disclaimer**
  - Not affiliated with or endorsed by Meta, Google, or any social platform
  - AI-generated content may require human review
  - No guarantee of ad performance or approval

  3. **Limitation of Liability**
  We are not responsible for any:
  - Rejected ads or account suspensions
  - Financial losses from using generated content
  `,

  inspector: `
  **Ad Inspector Terms**

  1. **Analysis Disclaimer**
  Our grading system provides suggestions only. Platform policies change frequently - always check current guidelines.

  2. **Data Handling**
  - Ad content is processed for analysis but not stored permanently
  - We don't claim ownership of submitted ads
  `,

  privacy: `
  **Privacy Policy**

  1. **Data Collection**
  - We store only necessary account information
  - Ad content is analyzed but not stored long-term

  2. **Third Parties**
  - We use OpenAI for content generation
  - Upstash for rate limiting
  - No sale of user data
  `
};

const PlatformDisclaimers = {
  meta: "Not affiliated with Meta (Facebook/Instagram)",
  google: "Not affiliated with Google or Alphabet Inc.",
  general: "All trademarks belong to their respective owners"
};

type AdVariation = {
  type: string;
  headline: string;
  primary_text: string;
  cta: string;
  visual_suggestion?: string;
};

type AdAnalysis = {
  grade: string;
  headlineGrade: string;
  bodyGrade: string;
  ctaGrade: string;
  summary: string;
  suggestions: string;
  rewrite?: string;
  complianceCheck: string;
};

type FormData = {
  targetAudience: string;
  goal: string;
  uniqueSellingPoint: string;
  contextDescription: string;
  brandVoice: string;
  keyEmotion: string;
  competitors: string;
  adFormat: string;
  industry: string;
  preferredCTA: string;
  visualDirection: string;
};

export default function Home() {
  // Ad Generator State
  const [formData, setFormData] = useState<FormData>({
    targetAudience: "",
    goal: "",
    uniqueSellingPoint: "",
    contextDescription: "",
    brandVoice: "Professional",
    keyEmotion: "FOMO",
    competitors: "",
    adFormat: "Single Image",
    industry: "General",
    preferredCTA: "Shop Now",
    visualDirection: "Lifestyle"
  });

  // Ad Inspector State
  const [adInput, setAdInput] = useState({
    headline: "",
    body: "",
    cta: "",
    offerDescription: "",
    websiteOrBrand: ""
  });
  const [adType, setAdType] = useState("facebook");
  const [previousAnalysisInput, setPreviousAnalysisInput] = useState("");

  // Shared State
  const [generatedAds, setGeneratedAds] = useState<AdVariation[]>([]);
  const [adAnalysis, setAdAnalysis] = useState<AdAnalysis | null>(null);
  const [loadingGen, setLoadingGen] = useState(false);
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [error, setError] = useState("");

  // Separate terms acceptance for each tool
  const [acceptedTermsGen, setAcceptedTermsGen] = useState(false);
  const [acceptedTermsInspect, setAcceptedTermsInspect] = useState(false);
  const [activeModal, setActiveModal] = useState<null | 'generator' | 'inspector' | 'privacy'>(null);

  // Options
  const brandVoices = ["Professional", "Friendly", "Witty", "Urgent", "Inspirational"];
  const keyEmotions = ["FOMO", "Trust", "Excitement", "Curiosity", "Anger/Solve Pain"];
  const adFormats = ["Single Image", "Carousel", "Video", "Story"];
  const industries = ["General", "Health", "Finance", "E-commerce", "SaaS", "Real Estate", "Other"];
  const preferredCTAs = ["Shop Now", "Learn More", "Get Offer", "Sign Up", "Book Now", "Claim Discount"];
  const visualDirections = ["Lifestyle", "Product Close-Up", "Before/After", "User-Generated", "Infographic"];
  const adTypes = ["facebook", "instagram", "google-search", "google-display"];

  // Refs for scroll to results
  const generatorResultsRef = useRef<HTMLDivElement>(null);
  const inspectorResultsRef = useRef<HTMLDivElement>(null);

  // Handlers
  const handleAdGenChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAdInspectChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setAdInput({ ...adInput, [e.target.name]: e.target.value });
  };

  const handleAdGenSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!acceptedTermsGen) return setError("Please accept the generator terms");
    
    setLoadingGen(true);
    setGeneratedAds([]);
    setError("");
    
    try {
      const response = await fetch("/api/generate-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (data.ads) {
        setGeneratedAds(data.ads);
        generatorResultsRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        throw new Error(data.error || "No ads generated");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to generate ads");
    } finally {
      setLoadingGen(false);
    }
  };

  const handleAdInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTermsInspect) return setError("Please accept the inspector terms");

    const currentInput = JSON.stringify({ ...adInput, adType });
    if (currentInput === previousAnalysisInput) {
      return setError("Please modify some fields to get a new analysis");
    }

    setLoadingInspect(true);
    setAdAnalysis(null);
    setError("");
    
    try {
      const response = await fetch("/api/inspect-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...adInput,
          adType,
          industry: formData.industry
        })
      });
      
      const data = await response.json();
      if (data.analysis) {
        setAdAnalysis(data.analysis);
        setPreviousAnalysisInput(currentInput);
        inspectorResultsRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        throw new Error(data.error || "No analysis generated");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to analyze ad");
    } finally {
      setLoadingInspect(false);
    }
  };

  // Modal component
  const LegalModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl max-h-[80vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">
          {activeModal === 'generator' ? 'Generator Terms' : 
           activeModal === 'inspector' ? 'Inspector Terms' : 'Privacy Policy'}
        </h3>
        <div className="prose prose-sm">
          <pre className="whitespace-pre-wrap">
            {activeModal === 'generator' ? TermsAndConditions.generator : 
             activeModal === 'inspector' ? TermsAndConditions.inspector : 
             TermsAndConditions.privacy}
          </pre>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          <p>{PlatformDisclaimers.meta}</p>
          <p>{PlatformDisclaimers.google}</p>
        </div>
        <button
          onClick={() => setActiveModal(null)}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Close
        </button>
      </div>
    </div>
  );

  // Terms checkbox component
  const TermsCheckbox = ({ tool }: { tool: 'generator' | 'inspector' }) => (
    <div className="flex items-center space-x-2 mb-4">
      <input
        type="checkbox"
        id={`accept-${tool}-terms`}
        checked={tool === 'generator' ? acceptedTermsGen : acceptedTermsInspect}
        onChange={() => tool === 'generator' 
          ? setAcceptedTermsGen(!acceptedTermsGen) 
          : setAcceptedTermsInspect(!acceptedTermsInspect)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
      />
      <label htmlFor={`accept-${tool}-terms`} className="text-sm">
        I accept the{' '}
        <button 
          type="button" 
          onClick={() => setActiveModal(tool)} 
          className="text-blue-600 underline"
        >
          {tool} terms
        </button>{' '}
        and{' '}
        <button
          type="button"
          onClick={() => setActiveModal('privacy')}
          className="text-blue-600 underline"
        >
          privacy policy
        </button>
      </label>
    </div>
  );

  return (
    <main className="p-4 max-w-screen-xl mx-auto">
      <h1 className="text-4xl font-bold mb-2 text-center">🎯 DFY Ad Toolkit PRO</h1>
      <p className="text-center text-sm text-gray-600 mb-6">
        AI-Powered Advertising Tools for Higher Conversions
      </p>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ad Generator */}
        <div className="p-6 border rounded-lg shadow-md bg-white">
          <h2 className="text-2xl font-semibold mb-3">🚀 Ad Generator</h2>
          <form onSubmit={handleAdGenSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience *</label>
                  <input
                    type="text"
                    name="targetAudience"
                    value={formData.targetAudience}
                    onChange={handleAdGenChange}
                    placeholder="E.g., Busy moms aged 25-40"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad Goal *</label>
                  <input
                    type="text"
                    name="goal"
                    value={formData.goal}
                    onChange={handleAdGenChange}
                    placeholder="E.g., Increase signups, drive sales"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unique Selling Point *</label>
                  <input
                    type="text"
                    name="uniqueSellingPoint"
                    value={formData.uniqueSellingPoint}
                    onChange={handleAdGenChange}
                    placeholder="What makes you different?"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              {/* Right Column */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Voice</label>
                  <select
                    name="brandVoice"
                    value={formData.brandVoice}
                    onChange={handleAdGenChange}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  >
                    {brandVoices.map(voice => (
                      <option key={voice} value={voice}>{voice}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Emotion</label>
                  <select
                    name="keyEmotion"
                    value={formData.keyEmotion}
                    onChange={handleAdGenChange}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  >
                    {keyEmotions.map(emotion => (
                      <option key={emotion} value={emotion}>{emotion}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleAdGenChange}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  >
                    {industries.map(industry => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business/Offer Description *</label>
              <textarea
                name="contextDescription"
                value={formData.contextDescription}
                onChange={handleAdGenChange}
                placeholder="Elevator pitch (max 500 chars)"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                rows={3}
                maxLength={500}
                required
              />
              <p className="text-xs text-gray-500 text-right mt-1">
                {500 - formData.contextDescription.length} characters remaining
              </p>
            </div>
            
            <TermsCheckbox tool="generator" />
            
            <button 
              type="submit" 
              disabled={!acceptedTermsGen || loadingGen}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingGen ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Ads...
                </span>
              ) : "Generate Professional Ads"}
            </button>
          </form>
          
          {generatedAds.length > 0 && (
            <div ref={generatorResultsRef} className="mt-6 space-y-6">
              <h3 className="text-xl font-bold">Your AI-Generated Ads</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedAds.map((ad, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {ad.type}
                      </span>
                      <span className="text-xs text-gray-500">Ad #{index + 1}</span>
                    </div>
                    <h4 className="font-bold mb-2">{ad.headline}</h4>
                    <p className="text-sm mb-3 whitespace-pre-line">{ad.primary_text}</p>
                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded inline-block">
                      {ad.cta}
                    </div>
                    {ad.visual_suggestion && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-gray-700">Visual Suggestion:</p>
                        <p className="text-xs text-gray-600">{ad.visual_suggestion}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ad Inspector */}
        <div className="p-6 border rounded-lg shadow-md bg-white">
          <h2 className="text-2xl font-semibold mb-3">🔍 Ad Inspector</h2>
          <form onSubmit={handleAdInspectSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad Platform</label>
              <select
                value={adType}
                onChange={(e) => setAdType(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              >
                {adTypes.map(type => (
                  <option key={type} value={type}>
                    {type === "facebook" ? "Facebook" : 
                     type === "instagram" ? "Instagram" : 
                     type === "google-search" ? "Google Search" : "Google Display"}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headline *</label>
              <input
                type="text"
                name="headline"
                value={adInput.headline}
                onChange={handleAdInspectChange}
                placeholder="Your ad headline"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad Body *</label>
              <textarea
                name="body"
                value={adInput.body}
                onChange={handleAdInspectChange}
                placeholder="Main ad copy"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                rows={3}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Call to Action *</label>
              <input
                type="text"
                name="cta"
                value={adInput.cta}
                onChange={handleAdInspectChange}
                placeholder="E.g., Shop Now, Learn More"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">About Your Offer *</label>
              <textarea
                name="offerDescription"
                value={adInput.offerDescription}
                onChange={handleAdInspectChange}
                placeholder="Describe what you're offering"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                rows={2}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website/Brand Name</label>
              <input
                type="text"
                name="websiteOrBrand"
                value={adInput.websiteOrBrand}
                onChange={handleAdInspectChange}
                placeholder="Optional but helpful for analysis"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <TermsCheckbox tool="inspector" />
            
            <button 
              type="submit" 
              disabled={!acceptedTermsInspect || loadingInspect}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingInspect ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </span>
              ) : "Analyze My Ad"}
            </button>
          </form>
          
          {adAnalysis && (
            <div ref={inspectorResultsRef} className="mt-6 space-y-4">
              <h3 className="text-xl font-bold">Ad Analysis Results</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Overall Grade</h4>
                  <span className={`text-xl font-bold ${
                    adAnalysis.grade === 'A' ? 'text-green-600' :
                    adAnalysis.grade === 'B' ? 'text-blue-600' :
                    adAnalysis.grade === 'C' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {adAnalysis.grade}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="border p-3 rounded">
                    <p className="text-sm font-medium text-gray-700">Headline</p>
                    <p className={`text-lg font-semibold ${
                      adAnalysis.headlineGrade === 'A' ? 'text-green-600' :
                      adAnalysis.headlineGrade === 'B' ? 'text-blue-600' :
                      adAnalysis.headlineGrade === 'C' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {adAnalysis.headlineGrade}
                    </p>
                  </div>
                  
                  <div className="border p-3 rounded">
                    <p className="text-sm font-medium text-gray-700">Body Copy</p>
                    <p className={`text-lg font-semibold ${
                      adAnalysis.bodyGrade === 'A' ? 'text-green-600' :
                      adAnalysis.bodyGrade === 'B' ? 'text-blue-600' :
                      adAnalysis.bodyGrade === 'C' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {adAnalysis.bodyGrade}
                    </p>
                  </div>
                  
                  <div className="border p-3 rounded">
                    <p className="text-sm font-medium text-gray-700">CTA</p>
                    <p className={`text-lg font-semibold ${
                      adAnalysis.ctaGrade === 'A' ? 'text-green-600' :
                      adAnalysis.ctaGrade === 'B' ? 'text-blue-600' :
                      adAnalysis.ctaGrade === 'C' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {adAnalysis.ctaGrade}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-800">Summary:</p>
                    <p className="text-sm">{adAnalysis.summary}</p>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-800">Suggestions:</p>
                    <p className="text-sm">{adAnalysis.suggestions}</p>
                  </div>
                  
                  {adAnalysis.rewrite && (
                    <div>
                      <p className="font-medium text-gray-800">Improved Version:</p>
                      <div className="bg-white p-3 rounded border text-sm mt-2">
                        {adAnalysis.rewrite}
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t">
                    <p className="font-medium text-gray-800">Compliance Check:</p>
                    <p className="text-sm">{adAnalysis.complianceCheck}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Platform disclaimers in footer */}
      <footer className="mt-12 text-center text-xs text-gray-500">
        <p>{PlatformDisclaimers.meta}</p>
        <p>{PlatformDisclaimers.google}</p>
        <p>{PlatformDisclaimers.general}</p>
      </footer>

      {/* Legal Modal */}
      {activeModal && <LegalModal />}
    </main>
  );
}
// components/AdGeneratorForm.tsx
const handleSubmit = async (formData: any) => {
  try {
    const res = await fetch('/api/generate-ad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData),
      credentials: 'same-origin' // Important for cookies
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || 'Request failed');
    }

    const data = await res.json();
    setAds(data.ads);
  } catch (error: any) {
    console.error('Fetch error:', error);
    setError(error.message);
  }
};
function setAds(ads: any) {
  throw new Error("Function not implemented.");
}

function setError(message: any) {
  throw new Error("Function not implemented.");
}

