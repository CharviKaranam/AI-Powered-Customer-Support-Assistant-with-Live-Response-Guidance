import { jsPDF } from 'jspdf';
import { PostInteractionReport } from '../types.js';

export function exportReportToPDF(report: PostInteractionReport): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = margin;
      addPageHeader();
    }
  };

  const addPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 165);
    doc.text('RESOLVEAI SUPPORT COACHING — POST-INTERACTION QA PERFORMANCE REPORT', margin, 10);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 12, pageWidth - margin, 12);
  };

  // 1. Primary Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('Post-Interaction Performance & QA Report', margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const dateStr = new Date(report.generatedAt).toLocaleString();
  doc.text(`Session ID: ${report.sessionId}    |    Generated: ${dateStr}`, margin + 6, y + 17);

  // Status Badge in Banner
  const isResolved = report.interactionSummary.resolutionStatus === 'Resolved';
  const isEscalated = report.interactionSummary.escalated;
  const badgeText = isResolved ? 'STATUS: RESOLVED' : isEscalated ? 'STATUS: ESCALATED' : 'STATUS: UNRESOLVED';
  
  doc.setFillColor(isResolved ? 16 : isEscalated ? 225 : 217, isResolved ? 185 : isEscalated ? 29 : 119, isResolved ? 129 : isEscalated ? 72 : 6);
  doc.roundedRect(pageWidth - margin - 48, y + 5, 42, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, pageWidth - margin - 27, y + 9.5, { align: 'center' });

  y += 32;

  // 2. Score & Executive Summary Card
  checkPageBreak(38);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'FD');

  // Left column: Score Dial Box
  doc.setFillColor(isResolved ? 240 : 254, isResolved ? 253 : 242, isResolved ? 244 : 242);
  doc.setDrawColor(isResolved ? 187 : 254, isResolved ? 247 : 202, isResolved ? 208 : 202);
  doc.roundedRect(margin + 4, y + 4, 38, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('QUALITY SCORE', margin + 23, y + 10, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(isResolved ? 5 : 185, isResolved ? 150 : 28, isResolved ? 105 : 28);
  doc.text(`${report.resolutionQuality.score}`, margin + 23, y + 19, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('OUT OF 100', margin + 23, y + 25, { align: 'center' });

  // Right column: Assessment details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('Resolution Assessment Summary', margin + 46, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const reasoningLines = doc.splitTextToSize(report.resolutionQuality.reasoning || 'No details provided.', contentWidth - 52);
  doc.text(reasoningLines.slice(0, 4), margin + 46, y + 15);

  y += 40;

  // 3. Interaction Context & Outcomes Box
  checkPageBreak(42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Interaction Context & Final Outcome', margin, y);
  y += 4;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CUSTOMER ISSUE:', margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const issueLines = doc.splitTextToSize(report.interactionSummary.customerIssue || 'N/A', contentWidth - 36);
  doc.text(issueLines[0] || 'N/A', margin + 34, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PRIMARY GOAL:', margin + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const goalLines = doc.splitTextToSize(report.interactionSummary.customerObjective || 'N/A', contentWidth - 36);
  doc.text(goalLines[0] || 'N/A', margin + 34, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('FINAL OUTCOME:', margin + 4, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const outcomeLines = doc.splitTextToSize(report.interactionSummary.finalOutcome || report.interactionSummary.resolutionStatus, contentWidth - 36);
  doc.text(outcomeLines.slice(0, 2), margin + 34, y + 22);

  y += 38;

  // 4. Sentiment & Frustration Progression Table
  if (report.sentimentJourney && report.sentimentJourney.length > 0) {
    checkPageBreak(50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Customer Sentiment & Frustration Progression Across Turns', margin, y);
    y += 4;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('TURN', margin + 3, y + 4.5);
    doc.text('SPEAKER', margin + 16, y + 4.5);
    doc.text('SENTIMENT / EMOTION', margin + 38, y + 4.5);
    doc.text('FRUSTRATION', margin + 80, y + 4.5);
    doc.text('MESSAGE EXCERPT', margin + 110, y + 4.5);
    y += 8;

    report.sentimentJourney.slice(0, 8).forEach((pt, index) => {
      checkPageBreak(10);
      const isEven = index % 2 === 0;
      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 1, contentWidth, 7.5, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`#${pt.turn}`, margin + 3, y + 4);

      const isAgent = pt.sender === 'agent';
      doc.setTextColor(isAgent ? 79 : 15, isAgent ? 70 : 118, isAgent ? 229 : 110);
      doc.text(isAgent ? 'Support Agent' : 'Customer', margin + 16, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`${pt.sentiment} (${pt.emotion})`, margin + 38, y + 4);

      const fScore = pt.frustrationScore ?? 0;
      doc.setTextColor(fScore > 65 ? 220 : fScore > 35 ? 217 : 22, fScore > 65 ? 38 : fScore > 35 ? 119 : 101, fScore > 65 ? 38 : fScore > 35 ? 6 : 52);
      doc.text(`${fScore}/100`, margin + 80, y + 4);

      doc.setTextColor(71, 85, 105);
      const cleanExcerpt = (pt.messageExcerpt || '').replace(/[\n\r]+/g, ' ');
      const excerptCut = cleanExcerpt.length > 45 ? cleanExcerpt.slice(0, 42) + '...' : cleanExcerpt;
      doc.text(`"${excerptCut}"`, margin + 110, y + 4);

      y += 8;
    });

    y += 4;
  }

  // 5. Strengths and Coaching Recommendations
  checkPageBreak(55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Agent Performance Highlights & Improvement Areas', margin, y);
  y += 4;

  const halfWidth = (contentWidth - 4) / 2;

  // Box 1: Strengths
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(margin, y, halfWidth, 42, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text('Key Strengths Demonstrated', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  let strY = y + 12;
  const strengths = report.coachingRecommendations.strengths || ['Handled customer with calm tone', 'Acknowledged problem promptly'];
  strengths.slice(0, 3).forEach(str => {
    const lines = doc.splitTextToSize(`• ${str}`, halfWidth - 8);
    doc.text(lines.slice(0, 2), margin + 4, strY);
    strY += lines.length * 4.2;
  });

  // Box 2: Areas for Improvement
  doc.setFillColor(255, 251, 235); // amber-50
  doc.setDrawColor(254, 243, 199); // amber-200
  doc.roundedRect(margin + halfWidth + 4, y, halfWidth, 42, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text('Areas for Coaching Focus', margin + halfWidth + 8, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  let impY = y + 12;
  const areas = report.coachingRecommendations.areasForImprovement || ['Provide concrete resolution timeframes', 'Leverage KB articles earlier'];
  areas.slice(0, 3).forEach(area => {
    const lines = doc.splitTextToSize(`• ${area}`, halfWidth - 8);
    doc.text(lines.slice(0, 2), margin + halfWidth + 8, impY);
    impY += lines.length * 4.2;
  });

  y += 48;

  // 6. Actionable Next Steps
  if (report.coachingRecommendations.recommendedActions?.length) {
    checkPageBreak(30);
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.setDrawColor(199, 210, 254); // indigo-200
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 48, 163); // indigo-800
    doc.text('Actionable Next Steps for Representative Mastery', margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(67, 56, 202);
    let actY = y + 11;
    report.coachingRecommendations.recommendedActions.slice(0, 2).forEach(act => {
      const lines = doc.splitTextToSize(`-> ${act}`, contentWidth - 8);
      doc.text(lines.slice(0, 2), margin + 4, actY);
      actY += 5;
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    doc.text('ResolveAI AI Customer Support Coaching Engine — Confidential Evaluation Report', margin, pageHeight - 8);
  }

  // Trigger browser download
  doc.save(`ResolveAI_QA_Report_Session_${report.sessionId}.pdf`);
}
