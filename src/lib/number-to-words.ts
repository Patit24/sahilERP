export function numberToWords(num: number): string {
  if (num === 0) return 'Zero'

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  let numStr = num.toString();
  if (numStr.length > 9) return 'overflow';
  num = numStr as unknown as number;
  
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  
  let str = '';
  str += (n[1] != '00') ? (a[Number(n[1])] || b[n[1][0] as unknown as number] + ' ' + a[n[1][1] as unknown as number]) + 'Crore ' : '';
  str += (n[2] != '00') ? (a[Number(n[2])] || b[n[2][0] as unknown as number] + ' ' + a[n[2][1] as unknown as number]) + 'Lakh ' : '';
  str += (n[3] != '00') ? (a[Number(n[3])] || b[n[3][0] as unknown as number] + ' ' + a[n[3][1] as unknown as number]) + 'Thousand ' : '';
  str += (n[4] != '0') ? (a[Number(n[4])] || b[n[4][0] as unknown as number] + ' ' + a[n[4][1] as unknown as number]) + 'Hundred ' : '';
  str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0] as unknown as number] + ' ' + a[n[5][1] as unknown as number]) : '';
  
  return str.trim();
}

export function amountToWords(amount: number): string {
  const wholePart = Math.floor(amount);
  const decimalPart = Math.round((amount - wholePart) * 100);
  
  let words = `INR ${numberToWords(wholePart)} Only`;
  
  // if (decimalPart > 0) {
  //   words = `INR ${numberToWords(wholePart)} and ${numberToWords(decimalPart)} Paise Only`;
  // }
  
  return words;
}
