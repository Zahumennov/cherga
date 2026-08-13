import Link from "next/link";
import { InviteLinkButton } from "@/components/invite-link-button";

export default function Home() {
  return (
    <div>
      <div className="max-w-[600px] pt-[54px]">
        <div className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Rotating savings, kept honestly
        </div>
        <h1 className="mt-[14px] mb-5 text-[40px] leading-[1.12] font-normal tracking-[-0.01em]">
          A cash box that no one has to hold.
        </h1>
        <p className="mb-4 text-[oklch(0.32_0.012_85)]">
          A fixed group of 2–20 people chip in the same amount on the same
          schedule, and each round the whole pool goes to one member — in
          turn, until everyone has received it exactly once. Eight friends,
          $100 each month: someone takes home $800 every month, and after
          eight months everyone has paid in $800 and received $800. Whoever
          goes first borrowed at no interest. Whoever goes last lent at no
          interest.
        </p>
        <p className="text-[oklch(0.32_0.012_85)]">
          People have run this for centuries — <em>tanda</em> in Mexico,{" "}
          <em>susu</em> in West Africa, <em>hui</em> in China,{" "}
          <em>chit funds</em> in India, <em>pardna</em> in Jamaica. Cherga is
          the same arrangement written as a smart contract, so the
          bookkeeping can&rsquo;t be faked and no one has to be the
          treasurer.
        </p>
      </div>

      <div className="mt-[34px] border-t border-b border-border py-5">
        <div className="mb-2.5 font-mono text-[9.5px] tracking-[0.14em] text-primary uppercase">
          Read this first
        </div>
        <p className="max-w-[560px] text-[19px] leading-[1.5]">
          This isn&rsquo;t insured and it isn&rsquo;t reversible. Nothing
          here protects you if a friend stops paying — there is no
          collateral and no one to appeal to. Only share a circle with
          people you&rsquo;d trust with cash in person.
        </p>
      </div>

      <div className="mt-[26px] flex flex-wrap items-start gap-3">
        <Link
          href="/create"
          className="border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)]"
        >
          Create a circle
        </Link>
        <InviteLinkButton />
      </div>

      <div className="mt-[46px] grid grid-cols-1 gap-x-10 gap-y-[26px] border-t border-border pt-[22px] sm:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase">
            This might not be for you
          </div>
          <p className="text-base text-[oklch(0.36_0.012_85)]">
            If your group is in one place and one currency, a shared
            spreadsheet and a jar will do the job better. If you&rsquo;re
            looking for a return on money, this pays none — by design. If
            you don&rsquo;t already know every person in the circle
            personally, close this page.
          </p>
        </div>
        <div>
          <div className="mb-2 font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase">
            It might be for you
          </div>
          <p className="text-base text-[oklch(0.36_0.012_85)]">
            Friends spread across countries who can&rsquo;t pass a box
            around. Groups who already hold stablecoins. People whose local
            currency loses value while they wait their turn.
          </p>
        </div>
      </div>
    </div>
  );
}
