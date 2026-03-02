import type { LeadDetail } from './types'

function fmtDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}

function fmtAmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function convert(n: number): string {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }
  const rupees = Math.floor(num)
  const paise = Math.round((num - rupees) * 100)
  let result = 'INR ' + convert(rupees)
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise'
  return result + ' Only'
}

export function generateInvoice(lead: LeadDetail) {
  const invoiceNo = lead.invoice_number || `INV-${lead.id}`
  const invoiceDate = fmtDate(lead.invoice_date || lead.modified)

  const netAmount = lead.amount_cityflo ?? 0
  const cgstRate = 2.5
  const sgstRate = 2.5
  const cgstAmt = Math.round(netAmount * cgstRate) / 100
  const sgstAmt = Math.round(netAmount * sgstRate) / 100
  const totalAmount = netAmount + cgstAmt + sgstAmt
  const totalTax = cgstAmt + sgstAmt

  const tripDesc = `${lead.origin.split(',')[0]} - ${lead.destination.split(',')[0]}, ${lead.vehicle_type_requirement ?? 'Vehicle'}, ${fmtDate(lead.start_date_time)} - ${fmtDate(lead.end_date_time)}`
  const hasGst = lead.gst_aadhaar_number && lead.gst_aadhaar_number.length > 10

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tax Invoice ${invoiceNo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 8mm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 11px; color: #000; background: #e0e0e0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 6mm; }
  @media screen { .page { margin: 60px auto 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.2); } }
  @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; } .no-print { display: none !important; } }

  table { border-collapse: collapse; }
  .outer { width: 100%; border: 1.5px solid #000; }
  .outer td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; font-size: 11px; line-height: 1.45; }
  .outer .no-border { border: none; }
  .outer .border-b { border-bottom: 1px solid #000; }
  .outer .border-r { border-right: 1px solid #000; }
  .outer .border-t { border-top: 1px solid #000; }
  .outer .border-l { border-left: 1px solid #000; }
  .outer .no-border-b { border-bottom: none; }
  .outer .no-border-t { border-top: none; }
  .outer .no-border-l { border-left: none; }
  .outer .no-border-r { border-right: none; }

  .title { text-align: center; font-size: 15px; font-weight: bold; padding: 4px; border-bottom: 1.5px solid #000; }
  .bold { font-weight: bold; }
  .right { text-align: right; }
  .center { text-align: center; }
  .small { font-size: 10px; }
  .label-text { font-size: 10px; color: #444; }
  .company-name { font-weight: bold; font-size: 12.5px; }
  .client-name { font-weight: bold; font-size: 12px; }

  /* Items table */
  .items { width: 100%; border-collapse: collapse; }
  .items th { border: 1px solid #000; padding: 4px 6px; font-size: 10.5px; font-weight: bold; text-align: center; }
  .items td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 3px 6px; font-size: 11px; vertical-align: top; }
  .items .border-b td { border-bottom: 1px solid #000; }
  .items .total-row td { border-top: 1.5px solid #000; border-bottom: 1px solid #000; font-weight: bold; }

  /* Tax table */
  .tax-tbl { width: 100%; border-collapse: collapse; }
  .tax-tbl th, .tax-tbl td { border: 1px solid #000; padding: 3px 6px; font-size: 10px; text-align: center; }
  .tax-tbl th { font-weight: bold; }
  .tax-tbl .right { text-align: right; }

  /* Bottom */
  .bot-tbl { width: 100%; border-collapse: collapse; }
  .bot-tbl td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 10.5px; line-height: 1.5; }

  .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1e293b; padding: 10px 24px; display: flex; align-items: center; gap: 12px; z-index: 100; }
  .print-bar button { padding: 8px 20px; border-radius: 6px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; }
  .btn-print { background: #3b82f6; color: #fff; } .btn-print:hover { background: #2563eb; }
  .btn-close { background: #374151; color: #d1d5db; } .btn-close:hover { background: #4b5563; }
  .print-bar span { color: #94a3b8; font-size: 13px; }
</style>
</head>
<body>

<div class="print-bar no-print">
  <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  <button class="btn-close" onclick="window.close()">Close</button>
  <span>Tax Invoice ${invoiceNo} — ${lead.name}</span>
</div>

<div class="page">

<!-- TITLE -->
<div class="title" style="border:1.5px solid #000; border-bottom:1.5px solid #000;">TAX INVOICE</div>

<!-- HEADER: Company Info (left) + Invoice Meta (right) -->
<table class="outer" style="border-top:none;">
  <tr>
    <!-- Company Info - spans 8 meta rows -->
    <td rowspan="8" style="width:55%; border-top:none; vertical-align:top; padding:6px 8px; line-height:1.5;">
      <span class="company-name">Komorebi Tech Solutions Pvt Ltd</span><br>
      4th Floor, Unit No. 407 &amp; 408, Centrum Bldg<br>
      Plot No. C3, S. G. Barve Road,<br>
      Wagle Estate&nbsp; Thane West - 400604<br>
      UDYAM : UDYAM-MH-33-0154766 (Small/Services)<br>
      GSTIN/UIN: 27AAFCK8608N1ZY<br>
      State Name : Maharashtra, Code : 27<br>
      E-Mail : billing@cityflo.com
    </td>
    <!-- Row 1: Invoice No label | Dated label -->
    <td style="width:22.5%; border-top:none;"><span class="label-text">Invoice No.</span></td>
    <td style="width:22.5%; border-top:none;"><span class="label-text">Dated</span></td>
  </tr>
  <tr>
    <!-- Row 2: Invoice No value | Dated value -->
    <td class="bold">${invoiceNo}</td>
    <td class="bold">${invoiceDate}</td>
  </tr>
  <tr>
    <td><span class="label-text">Delivery Note</span></td>
    <td><span class="label-text">Mode/Terms of Payment</span></td>
  </tr>
  <tr>
    <td>&nbsp;</td>
    <td>&nbsp;</td>
  </tr>
  <tr>
    <td><span class="label-text">Reference No. &amp; Date.</span></td>
    <td><span class="label-text">Other References</span></td>
  </tr>
  <tr>
    <td class="bold">${invoiceNo} dt. ${invoiceDate}</td>
    <td>&nbsp;</td>
  </tr>
  <tr>
    <td><span class="label-text">Buyer's Order No.</span></td>
    <td><span class="label-text">Dated</span></td>
  </tr>
  <tr>
    <td>&nbsp;</td>
    <td>&nbsp;</td>
  </tr>
</table>

<!-- Consignee + remaining meta -->
<table class="outer" style="border-top:none;">
  <tr>
    <td rowspan="4" style="width:55%; vertical-align:top; padding:6px 8px; line-height:1.5; border-top:none;">
      <span class="label-text">Consignee (Ship to)</span><br>
      <span class="client-name">${lead.name.toUpperCase()}</span><br>
      ${lead.origin}<br>
      ${hasGst ? `GSTIN/UIN &nbsp;: ${lead.gst_aadhaar_number}<br>` : ''}
      State Name &nbsp;&nbsp;: Maharashtra, Code : 27
    </td>
    <td style="width:22.5%; border-top:none;"><span class="label-text">Dispatch Doc No.</span></td>
    <td style="width:22.5%; border-top:none;"><span class="label-text">Delivery Note Date</span></td>
  </tr>
  <tr>
    <td>&nbsp;</td>
    <td>&nbsp;</td>
  </tr>
  <tr>
    <td><span class="label-text">Dispatched through</span></td>
    <td><span class="label-text">Destination</span></td>
  </tr>
  <tr>
    <td>&nbsp;</td>
    <td>&nbsp;</td>
  </tr>
</table>

<!-- Buyer + Terms of Delivery -->
<table class="outer" style="border-top:none;">
  <tr>
    <td rowspan="2" style="width:55%; vertical-align:top; padding:6px 8px; line-height:1.5; border-top:none;">
      <span class="label-text">Buyer (Bill to)</span><br>
      <span class="client-name">${lead.name.toUpperCase()}</span><br>
      ${lead.origin}<br>
      ${hasGst ? `GSTIN/UIN &nbsp;: ${lead.gst_aadhaar_number}<br>` : ''}
      State Name &nbsp;&nbsp;: Maharashtra, Code : 27
    </td>
    <td colspan="2" style="width:45%; border-top:none;"><span class="label-text">Terms of Delivery</span></td>
  </tr>
  <tr>
    <td colspan="2">&nbsp;</td>
  </tr>
</table>

<!-- IRN -->
<table class="outer" style="border-top:none;">
  <tr>
    <td style="padding:4px 8px; line-height:1.6; border-top:none;">
      IRN &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:<br>
      Ack No. &nbsp;&nbsp;&nbsp;:<br>
      Ack Date &nbsp;:
    </td>
  </tr>
</table>

<!-- ITEMS TABLE -->
<table class="items" style="border-top:none;">
  <thead>
    <tr>
      <th style="width:30px; border-top:none;">Sl<br>No.</th>
      <th style="border-top:none;">Particulars</th>
      <th style="width:65px; border-top:none;">HSN/SAC</th>
      <th style="width:60px; border-top:none;">Quantity</th>
      <th style="width:55px; border-top:none;">Rate</th>
      <th style="width:35px; border-top:none;">per</th>
      <th style="width:85px; border-top:none;">Amount</th>
    </tr>
  </thead>
  <tbody>
    <!-- Line item -->
    <tr>
      <td class="center" style="padding-top:8px;">1</td>
      <td style="padding-top:8px;">
        <b>Bus Rental Service</b><br>
        <i style="font-size:10px;">${tripDesc}</i>
      </td>
      <td class="center" style="padding-top:8px;">996601</td>
      <td></td>
      <td></td>
      <td></td>
      <td class="right" style="padding-top:8px;">${fmtAmt(netAmount)}</td>
    </tr>
    <!-- CGST -->
    <tr>
      <td></td>
      <td style="padding-left:30px;">Output CGST@${cgstRate.toFixed(2)}%_Mumbai</td>
      <td></td>
      <td></td>
      <td class="right">${cgstRate.toFixed(2)} %</td>
      <td></td>
      <td class="right">${fmtAmt(cgstAmt)}</td>
    </tr>
    <!-- SGST -->
    <tr>
      <td></td>
      <td style="padding-left:30px;">Output SGST@${sgstRate.toFixed(2)}%_Mumbai</td>
      <td></td>
      <td></td>
      <td class="right">${sgstRate.toFixed(2)} %</td>
      <td></td>
      <td class="right">${fmtAmt(sgstAmt)}</td>
    </tr>
    <!-- Empty space -->
    <tr>
      <td style="height:150px;"></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <!-- Total -->
    <tr class="total-row">
      <td></td>
      <td class="right">Total</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td class="right bold">&#8377; ${fmtAmt(totalAmount)}</td>
    </tr>
  </tbody>
</table>

<!-- Amount in words -->
<table class="outer" style="border-top:none;">
  <tr>
    <td style="border-top:none; padding:3px 8px;">
      <span style="float:right; font-style:italic;">E. &amp; O.E</span>
      Amount Chargeable (in words)<br>
      <b>${numberToWords(totalAmount)}</b>
    </td>
  </tr>
</table>

<!-- Tax breakup -->
<table class="tax-tbl" style="border-top:none;">
  <thead>
    <tr>
      <th rowspan="2" style="border-top:none;">HSN/SAC</th>
      <th rowspan="2" style="border-top:none;">Taxable<br>Value</th>
      <th colspan="2" style="border-top:none;">CGST</th>
      <th colspan="2" style="border-top:none;">SGST/UTGST</th>
      <th rowspan="2" style="border-top:none;">Total<br>Tax Amount</th>
    </tr>
    <tr>
      <th>Rate</th>
      <th>Amount</th>
      <th>Rate</th>
      <th>Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>996601</td>
      <td class="right">${fmtAmt(netAmount)}</td>
      <td>${cgstRate.toFixed(2)}%</td>
      <td class="right">${fmtAmt(cgstAmt)}</td>
      <td>${sgstRate.toFixed(2)}%</td>
      <td class="right">${fmtAmt(sgstAmt)}</td>
      <td class="right">${fmtAmt(totalTax)}</td>
    </tr>
    <tr style="font-weight:bold;">
      <td class="right">Total</td>
      <td class="right">${fmtAmt(netAmount)}</td>
      <td></td>
      <td class="right">${fmtAmt(cgstAmt)}</td>
      <td></td>
      <td class="right">${fmtAmt(sgstAmt)}</td>
      <td class="right">${fmtAmt(totalTax)}</td>
    </tr>
  </tbody>
</table>

<!-- Tax in words -->
<table class="outer" style="border-top:none;">
  <tr>
    <td style="border-top:none; padding:4px 8px;">
      Tax Amount (in words) : &nbsp;<b>${numberToWords(totalTax)}</b>
    </td>
  </tr>
</table>

<!-- Bottom: Declaration (left) + Bank + Signatory (right) -->
<table class="bot-tbl" style="border-top:none;">
  <tr>
    <td style="width:50%; border-top:none; vertical-align:top;">
      <u><b>Declaration</b></u><br>
      Komorebi Tech Solutions Private Limited Registered under the MSME Development Act, 2006<br><br>
      As per the provisions of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006, all payments to MSMEs must be made within 45 days from the date of invoice.<br><br>
      In the event of delayed payment beyond this period, interest at the rate of 18% per annum on the invoice amount will be applicable.
      <br><br><br>
      <i>Customer's Seal and Signature</i>
    </td>
    <td style="width:50%; border-top:none; vertical-align:top;">
      <b>Company's Bank Details</b><br>
      <table style="font-size:10.5px; margin-top:4px; line-height:1.6; border:none;">
        <tr><td style="border:none; padding:1px 0;"><b>A/c Holder's Name :</b></td><td style="border:none; padding:1px 4px;">Komorebi Tech Solutions Pvt Ltd</td></tr>
        <tr><td style="border:none; padding:1px 0;"><b>Bank Name</b></td><td style="border:none; padding:1px 4px;">: Kotak Bank A/C No 0611663601</td></tr>
        <tr><td style="border:none; padding:1px 0;"><b>A/c No.</b></td><td style="border:none; padding:1px 4px;">: 0611663601</td></tr>
        <tr><td style="border:none; padding:1px 0;"><b>Branch &amp; IFS Code:</b></td><td style="border:none; padding:1px 4px;">KKBK0000663</td></tr>
      </table>
      <div style="text-align:right; margin-top:16px;"><b>for Komorebi Tech Solutions Pvt Ltd</b></div>
      <br><br>
      <div style="text-align:right;">Authorised Signatory</div>
      <br>
      <div style="text-align:right;"><b>for Komorebi Tech Solutions Pvt Ltd</b></div>
      <br>
      <div style="text-align:right;">Authorised Signatory</div>
    </td>
  </tr>
</table>

<!-- Computer generated -->
<div style="text-align:center; font-size:10px; padding:4px; border:1px solid #000; border-top:none; font-style:italic;">
  This is a Computer Generated Invoice
</div>

</div>
</body>
</html>`

  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
  }
  return invoiceNo
}
