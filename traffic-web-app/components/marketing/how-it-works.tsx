const shopperSteps = [
  { step: "1", title: "Browse", description: "Explore stores and products across categories." },
  { step: "2", title: "Order", description: "Add to cart, apply vouchers, and checkout securely." },
  { step: "3", title: "Receive", description: "Track your order and get it delivered to your door." },
];

const vendorSteps = [
  { step: "1", title: "Sign up", description: "Create your vendor account in a few minutes." },
  { step: "2", title: "Add products", description: "Upload your catalog with photos, prices, and details." },
  { step: "3", title: "Start selling", description: "Go live and reach customers on the Traffik marketplace." },
];

function StepList({
  title,
  accentClass,
  steps,
}: {
  title: string;
  accentClass: string;
  steps: { step: string; title: string; description: string }[];
}) {
  return (
    <div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <ol className="mt-6 space-y-6">
        {steps.map((item) => (
          <li key={item.step} className="flex gap-4">
            <span
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${accentClass}`}
            >
              {item.step}
            </span>
            <div>
              <p className="font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-sm text-gray-400">{item.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

type HowItWorksProps = {
  compact?: boolean;
  audience?: "both" | "shoppers" | "vendors";
};

export default function HowItWorks({
  compact = false,
  audience = "both",
}: HowItWorksProps) {
  const showShoppers = audience === "both" || audience === "shoppers";
  const showVendors = audience === "both" || audience === "vendors";
  const singleColumn = audience !== "both";

  return (
    <section className={`bg-gray-900 ${compact ? "py-16" : "py-20 sm:py-24"}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            How it works
          </h2>
          {!compact && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
              {audience === "both"
                ? "Whether you are shopping or selling, Traffik keeps the journey simple."
                : audience === "shoppers"
                  ? "Three simple steps to shop local on Traffik."
                  : "Three simple steps to launch your store on Traffik."}
            </p>
          )}
        </div>

        <div
          className={`mt-14 grid gap-12 ${singleColumn ? "max-w-lg mx-auto" : "lg:grid-cols-2 lg:gap-16"}`}
        >
          {showShoppers && (
            <StepList
              title="For shoppers"
              accentClass="bg-traffik-pink"
              steps={shopperSteps}
            />
          )}
          {showVendors && (
            <StepList
              title="For vendors"
              accentClass="bg-traffik-green"
              steps={vendorSteps}
            />
          )}
        </div>
      </div>
    </section>
  );
}
