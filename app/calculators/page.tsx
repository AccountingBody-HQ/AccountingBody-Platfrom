'use client'
import CalcCard from '@/components/CalcCard'

function fmt(n: number) { return isNaN(n) ? 'N/A' : '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function pct(n: number) { return isNaN(n) ? 'N/A' : (n * 100).toFixed(2) + '%' }
function rat(n: number) { return isNaN(n) ? 'N/A' : n.toFixed(2) + ':1' }
function dys(n: number) { return isNaN(n) ? 'N/A' : n.toFixed(1) + ' days' }
function tms(n: number) { return isNaN(n) ? 'N/A' : n.toFixed(2) + 'x' }
function uts(n: number) { return isNaN(n) ? 'N/A' : Math.ceil(n) + ' units' }
function p(v: Record<string,string>, k: string) { return parseFloat(v[k] ?? '') }

export default function CalculatorsPage() {
  return (
    <main style={{ background: '#F8F7F4', minHeight: '100vh' }}>
      <section style={{ background: '#0C1A3D', padding: '72px 0 56px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <span style={{ color: '#D4A017', fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Free Tools</span>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#fff', margin: '12px 0 16px', lineHeight: 1.1 }}>Accounting Calculators</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, maxWidth: 600, lineHeight: 1.7, margin: 0 }}>22 free instant calculators for ACCA, CIMA, ICAEW and AAT students. Results update as you type. No signup required.</p>
        </div>
      </section>

      <Section title="Financial Accounting" color="#004B8D">
        <CalcCard title="Straight-Line Depreciation" tag="Assets" description="Annual depreciation using the straight-line method."
          fields={[{id:'cost',label:'Asset Cost (£)',placeholder:'50000'},{id:'res',label:'Residual Value (£)',placeholder:'5000'},{id:'life',label:'Useful Life (years)',placeholder:'5'}]}
          calculate={v => { const c=p(v,'cost'),r=p(v,'res'),l=p(v,'life'); if([c,r,l].some(isNaN)||l===0)return null; const a=(c-r)/l; return [{label:'Annual Depreciation',value:fmt(a)},{label:'Depreciation Rate',value:pct(1/l)},{label:'NBV after Year 1',value:fmt(c-a)},{label:'Total Depreciation',value:fmt(c-r)}] }}
        />
        <CalcCard title="Reducing Balance Depreciation" tag="Assets" description="Depreciation using the reducing balance method."
          fields={[{id:'cost',label:'Asset Cost (£)',placeholder:'50000'},{id:'rate',label:'Depreciation Rate (%)',placeholder:'25'},{id:'year',label:'Year Number',placeholder:'3'}]}
          calculate={v => { const c=p(v,'cost'),r=p(v,'rate')/100,y=p(v,'year'); if([c,r,y].some(isNaN)||y<1)return null; const nbv=c*Math.pow(1-r,y); const charge=c*Math.pow(1-r,y-1)*r; return [{label:'Depreciation Charge',value:fmt(charge)},{label:'Net Book Value',value:fmt(nbv)},{label:'Total Written Off',value:fmt(c-nbv)}] }}
        />
        <CalcCard title="Gross Profit Margin" tag="P&L" description="Gross profit margin and markup on cost."
          fields={[{id:'rev',label:'Revenue (£)',placeholder:'100000'},{id:'cogs',label:'Cost of Sales (£)',placeholder:'60000'}]}
          calculate={v => { const r=p(v,'rev'),c=p(v,'cogs'); if([r,c].some(isNaN)||r===0)return null; const gp=r-c; return [{label:'Gross Profit',value:fmt(gp)},{label:'GP Margin',value:pct(gp/r)},{label:'Markup on Cost',value:c>0?pct(gp/c):'N/A'},{label:'Cost as % Revenue',value:pct(c/r)}] }}
        />
        <CalcCard title="Net Profit Margin" tag="P&L" description="Operating and net profit margins."
          fields={[{id:'rev',label:'Revenue (£)',placeholder:'100000'},{id:'ebit',label:'Operating Profit (£)',placeholder:'20000'},{id:'int',label:'Interest (£)',placeholder:'2000'},{id:'tax',label:'Tax (£)',placeholder:'4000'}]}
          calculate={v => { const r=p(v,'rev'),e=p(v,'ebit'),i=isNaN(p(v,'int'))?0:p(v,'int'),t=isNaN(p(v,'tax'))?0:p(v,'tax'); if([r,e].some(isNaN)||r===0)return null; const net=e-i-t; return [{label:'Operating Margin',value:pct(e/r)},{label:'Net Profit',value:fmt(net)},{label:'Net Profit Margin',value:pct(net/r)}] }}
        />
      </Section>

      <Section title="Liquidity and Efficiency" color="#0081C6">
        <CalcCard title="Current and Quick Ratio" tag="Liquidity" description="Short-term liquidity ratios."
          fields={[{id:'assets',label:'Current Assets (£)',placeholder:'80000'},{id:'inv',label:'Inventory (£)',placeholder:'20000'},{id:'liab',label:'Current Liabilities (£)',placeholder:'40000'}]}
          calculate={v => { const a=p(v,'assets'),inv=isNaN(p(v,'inv'))?0:p(v,'inv'),l=p(v,'liab'); if([a,l].some(isNaN)||l===0)return null; return [{label:'Current Ratio',value:rat(a/l)},{label:'Quick Ratio',value:rat((a-inv)/l)},{label:'Working Capital',value:fmt(a-l)}] }}
        />
        <CalcCard title="Receivables Days" tag="Efficiency" description="Average days to collect from customers."
          fields={[{id:'rec',label:'Trade Receivables (£)',placeholder:'30000'},{id:'rev',label:'Revenue (£)',placeholder:'180000'}]}
          calculate={v => { const r=p(v,'rec'),rev=p(v,'rev'); if([r,rev].some(isNaN)||rev===0)return null; return [{label:'Receivables Days',value:dys(r/rev*365)},{label:'Receivables Turnover',value:tms(rev/r)}] }}
        />
        <CalcCard title="Payables Days" tag="Efficiency" description="Average days taken to pay suppliers."
          fields={[{id:'pay',label:'Trade Payables (£)',placeholder:'20000'},{id:'cogs',label:'Cost of Sales (£)',placeholder:'120000'}]}
          calculate={v => { const pay=p(v,'pay'),c=p(v,'cogs'); if([pay,c].some(isNaN)||c===0)return null; return [{label:'Payables Days',value:dys(pay/c*365)}] }}
        />
        <CalcCard title="Inventory Turnover" tag="Efficiency" description="How many times inventory is sold and replaced."
          fields={[{id:'cogs',label:'Cost of Sales (£)',placeholder:'120000'},{id:'inv',label:'Average Inventory (£)',placeholder:'15000'}]}
          calculate={v => { const c=p(v,'cogs'),i=p(v,'inv'); if([c,i].some(isNaN)||i===0)return null; return [{label:'Inventory Turnover',value:tms(c/i)},{label:'Inventory Days',value:dys(i/c*365)}] }}
        />
      </Section>

      <Section title="Investment and Gearing" color="#8B0000">
        <CalcCard title="ROCE" tag="Investment" description="Return on Capital Employed."
          fields={[{id:'ebit',label:'Operating Profit (£)',placeholder:'30000'},{id:'assets',label:'Total Assets (£)',placeholder:'200000'},{id:'liab',label:'Current Liabilities (£)',placeholder:'50000'}]}
          calculate={v => { const e=p(v,'ebit'),a=p(v,'assets'),l=p(v,'liab'); if([e,a,l].some(isNaN))return null; const ce=a-l; if(ce===0)return null; return [{label:'Capital Employed',value:fmt(ce)},{label:'ROCE',value:pct(e/ce)}] }}
        />
        <CalcCard title="Gearing Ratio" tag="Gearing" description="Proportion of debt to equity."
          fields={[{id:'debt',label:'Non-Current Liabilities (£)',placeholder:'80000'},{id:'eq',label:'Total Equity (£)',placeholder:'120000'}]}
          calculate={v => { const d=p(v,'debt'),e=p(v,'eq'); if([d,e].some(isNaN)||(d+e)===0)return null; return [{label:'Gearing (D/E)',value:pct(d/e)},{label:'Gearing (D/D+E)',value:pct(d/(d+e))},{label:'Equity Ratio',value:pct(e/(d+e))}] }}
        />
        <CalcCard title="Interest Cover" tag="Gearing" description="How many times operating profit covers interest."
          fields={[{id:'ebit',label:'Operating Profit (£)',placeholder:'40000'},{id:'int',label:'Interest Expense (£)',placeholder:'8000'}]}
          calculate={v => { const e=p(v,'ebit'),i=p(v,'int'); if([e,i].some(isNaN)||i===0)return null; const ic=e/i; return [{label:'Interest Cover',value:tms(ic)},{label:'Status',value:ic>=2?'Adequate (2x+)':'Low (<2x)'}] }}
        />
        <CalcCard title="Earnings Per Share" tag="Investment" description="EPS and Price to Earnings ratio."
          fields={[{id:'profit',label:'Profit After Tax (£)',placeholder:'50000'},{id:'shares',label:'Number of Shares',placeholder:'100000'},{id:'price',label:'Share Price (£)',placeholder:'5'}]}
          calculate={v => { const pr=p(v,'profit'),sh=p(v,'shares'),sp=p(v,'price'); if([pr,sh].some(isNaN)||sh===0)return null; const eps=pr/sh; return [{label:'EPS',value:'£'+eps.toFixed(4)},{label:'P/E Ratio',value:!isNaN(sp)&&eps>0?tms(sp/eps):'N/A'}] }}
        />
      </Section>

      <Section title="Management Accounting" color="#00857A">
        <CalcCard title="Break-Even Analysis" tag="CVP" description="Break-even point in units and revenue."
          fields={[{id:'fixed',label:'Fixed Costs (£)',placeholder:'20000'},{id:'price',label:'Selling Price per Unit (£)',placeholder:'50'},{id:'vc',label:'Variable Cost per Unit (£)',placeholder:'30'}]}
          calculate={v => { const f=p(v,'fixed'),sp=p(v,'price'),vc=p(v,'vc'); if([f,sp,vc].some(isNaN))return null; const c=sp-vc; if(c<=0)return [{label:'Error',value:'Price must exceed variable cost'}]; const be=f/c; return [{label:'Contribution per Unit',value:fmt(c)},{label:'C/S Ratio',value:pct(c/sp)},{label:'Break-Even Units',value:uts(be)},{label:'Break-Even Revenue',value:fmt(be*sp)}] }}
        />
        <CalcCard title="Target Profit Output" tag="CVP" description="Units needed to achieve a target profit."
          fields={[{id:'fixed',label:'Fixed Costs (£)',placeholder:'20000'},{id:'target',label:'Target Profit (£)',placeholder:'10000'},{id:'price',label:'Selling Price per Unit (£)',placeholder:'50'},{id:'vc',label:'Variable Cost per Unit (£)',placeholder:'30'}]}
          calculate={v => { const f=p(v,'fixed'),t=p(v,'target'),sp=p(v,'price'),vc=p(v,'vc'); if([f,t,sp,vc].some(isNaN))return null; const c=sp-vc; if(c<=0)return [{label:'Error',value:'Price must exceed variable cost'}]; const n=(f+t)/c; return [{label:'Units Required',value:uts(n)},{label:'Required Revenue',value:fmt(n*sp)}] }}
        />
        <CalcCard title="Margin of Safety" tag="CVP" description="How far sales can fall before a loss is made."
          fields={[{id:'actual',label:'Actual Sales (units)',placeholder:'5000'},{id:'be',label:'Break-Even Sales (units)',placeholder:'3000'}]}
          calculate={v => { const a=p(v,'actual'),b=p(v,'be'); if([a,b].some(isNaN)||a===0)return null; const mos=a-b; return [{label:'Margin of Safety (units)',value:uts(mos)},{label:'Margin of Safety (%)',value:pct(mos/a)}] }}
        />
        <CalcCard title="Overhead Absorption Rate" tag="Costing" description="OAR based on budgeted overhead and activity."
          fields={[{id:'oh',label:'Budgeted Overhead (£)',placeholder:'60000'},{id:'act',label:'Budgeted Activity (hrs)',placeholder:'12000'}]}
          calculate={v => { const o=p(v,'oh'),a=p(v,'act'); if([o,a].some(isNaN)||a===0)return null; return [{label:'OAR',value:'£'+(o/a).toFixed(2)+' per hr'}] }}
        />
      </Section>

      <Section title="Taxation" color="#D4A017">
        <CalcCard title="VAT Calculator" tag="Indirect Tax" description="Add or remove VAT at any rate."
          fields={[{id:'amount',label:'Net Amount (£)',placeholder:'1000'},{id:'rate',label:'VAT Rate (%)',placeholder:'20'}]}
          calculate={v => { const a=p(v,'amount'),r=p(v,'rate'); if([a,r].some(isNaN))return null; const vat=a*(r/100); return [{label:'VAT Amount',value:fmt(vat)},{label:'Gross (inc. VAT)',value:fmt(a+vat)},{label:'Net from Gross',value:fmt(a/(1+r/100))},{label:'VAT Fraction',value:(r/(100+r)).toFixed(4)}] }}
        />
        <CalcCard title="UK Income Tax Estimator" tag="Direct Tax" description="2024/25 UK income tax — simplified estimate."
          fields={[{id:'income',label:'Gross Annual Income (£)',placeholder:'50000'}]}
          calculate={v => { const inc=p(v,'income'); if(isNaN(inc))return null; const pa=12570,tax1=Math.min(Math.max(0,inc-pa),37700)*0.20,tax2=Math.max(0,Math.min(inc-pa-37700,87440))*0.40,tax3=Math.max(0,inc-125140)*0.45,total=tax1+tax2+tax3; return [{label:'Personal Allowance',value:fmt(Math.min(inc,pa))},{label:'Basic Rate Tax (20%)',value:fmt(tax1)},{label:'Higher Rate Tax (40%)',value:fmt(tax2)},{label:'Additional Rate (45%)',value:fmt(tax3)},{label:'Total Income Tax',value:fmt(total)},{label:'Effective Rate',value:pct(inc>0?total/inc:0)}] }}
        />
        <CalcCard title="Corporation Tax" tag="Direct Tax" description="UK corporation tax estimate (FY2024 rates)."
          fields={[{id:'profit',label:'Taxable Profit (£)',placeholder:'100000'}]}
          calculate={v => { const pr=p(v,'profit'); if(isNaN(pr))return null; let tax=0; if(pr<=50000)tax=pr*0.19; else if(pr>=250000)tax=pr*0.25; else tax=pr*0.25-(250000-pr)*3/200; return [{label:'Corporation Tax',value:fmt(tax)},{label:'Effective Rate',value:pct(tax/pr)},{label:'Profit After Tax',value:fmt(pr-tax)}] }}
        />
        <CalcCard title="Capital Gains Tax" tag="Direct Tax" description="Simplified CGT estimate for individuals (2024/25)."
          fields={[{id:'proceeds',label:'Sale Proceeds (£)',placeholder:'50000'},{id:'cost',label:'Original Cost (£)',placeholder:'20000'},{id:'income',label:'Other Taxable Income (£)',placeholder:'30000'}]}
          calculate={v => { const pr=p(v,'proceeds'),c=p(v,'cost'),inc=isNaN(p(v,'income'))?0:p(v,'income'); if([pr,c].some(isNaN))return null; const gain=pr-c,exempt=3000,taxable=Math.max(0,gain-exempt),rem=Math.max(0,37700-inc),cgt=Math.min(taxable,rem)*0.18+Math.max(0,taxable-rem)*0.24; return [{label:'Capital Gain',value:fmt(gain)},{label:'Annual Exempt Amount',value:fmt(Math.min(gain,exempt))},{label:'Taxable Gain',value:fmt(taxable)},{label:'CGT Due',value:fmt(cgt)}] }}
        />
      </Section>

      <Section title="Payroll" color="#475569">
        <CalcCard title="Employee Net Pay" tag="Payroll" description="Estimated take-home pay after tax and NI (2024/25)."
          fields={[{id:'salary',label:'Annual Gross Salary (£)',placeholder:'30000'}]}
          calculate={v => { const s=p(v,'salary'); if(isNaN(s))return null; const pa=12570,tax=Math.min(Math.max(0,s-pa),37700)*0.20+Math.max(0,s-pa-37700)*0.40,ni=Math.max(0,Math.min(s,50270)-12570)*0.08+Math.max(0,s-50270)*0.02,net=s-tax-ni; return [{label:'Income Tax',value:fmt(tax)},{label:'Employee NI',value:fmt(ni)},{label:'Net Annual Pay',value:fmt(net)},{label:'Net Monthly',value:fmt(net/12)},{label:'Effective Rate',value:pct((tax+ni)/s)}] }}
        />
        <CalcCard title="Employer NI Cost" tag="Payroll" description="Employer National Insurance contribution (2024/25)."
          fields={[{id:'salary',label:'Annual Salary (£)',placeholder:'30000'}]}
          calculate={v => { const s=p(v,'salary'); if(isNaN(s))return null; const ni=Math.max(0,s-9100)*0.138; return [{label:'Employer NI',value:fmt(ni)},{label:'Total Staff Cost',value:fmt(s+ni)},{label:'NI Rate',value:'13.8%'}] }}
        />
      </Section>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 1.7 }}>
          For educational purposes only. Always verify with a qualified accountant. Tax rates shown are 2024/25 UK unless otherwise stated.
        </p>
      </div>
    </main>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 4, height: 28, borderRadius: 4, background: color }} />
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', color: '#0C1A3D', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {children}
      </div>
    </section>
  )
}
