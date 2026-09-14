(()=>{
  const ID='vhMorningReadableTypeV1';
  if(document.getElementById(ID)) return;
  const s=document.createElement('style');
  s.id=ID;
  s.textContent=`
  /* Tăng 1 bậc cỡ chữ cho phần nội dung đọc chính, giữ nguyên tiêu đề/nhãn */
  #vhDecisionBoardV5 .vh5-verdict-sub,
  #vhDecisionBoardV5 .vh5-board2-step p,
  #vhDecisionBoardV5 .vh5-card p,
  #vhDecisionBoardV5 .vh5-card .vh5-evidence,
  #vhDecisionBoardV5 .vh5-card .vh5-impact,
  #vhDecisionBoardV5 .vh5-macro-regime,
  #vhDecisionBoardV5 .vh5-macro-regime li,
  #vhDecisionBoardV5 .vh5-action li,
  #vhDecisionBoardV5 .vh5-action p,
  #vhDecisionBoardV5 .vh5-scenario p,
  #vhDecisionBoardV5 .vh5-watch-caption{
    font-size:14.5px !important;
    line-height:1.6 !important;
  }

  /* Text nhấn màu đỏ cần dễ đọc hơn */
  #vhDecisionBoardV5 .vh5-impact,
  #vhDecisionBoardV5 .bad,
  #vhDecisionBoardV5 .vh2-status-negative,
  #vhDecisionBoardV5 [class*='risk'] p,
  #vhDecisionBoardV5 [class*='negative'] p{
    font-size:14.5px !important;
    line-height:1.6 !important;
  }

  /* Các dòng nhỏ trong chip cổ phiếu T+ */
  #vhDecisionBoardV5 .vh5-stock-chip span{
    font-size:13px !important;
    line-height:1.42 !important;
  }
  #vhDecisionBoardV5 .vh5-stock-chip small{
    font-size:12.2px !important;
    line-height:1.42 !important;
  }

  @media (max-width:720px){
    #vhDecisionBoardV5 .vh5-verdict-sub,
    #vhDecisionBoardV5 .vh5-board2-step p,
    #vhDecisionBoardV5 .vh5-card p,
    #vhDecisionBoardV5 .vh5-card .vh5-evidence,
    #vhDecisionBoardV5 .vh5-card .vh5-impact,
    #vhDecisionBoardV5 .vh5-macro-regime,
    #vhDecisionBoardV5 .vh5-macro-regime li,
    #vhDecisionBoardV5 .vh5-action li,
    #vhDecisionBoardV5 .vh5-action p,
    #vhDecisionBoardV5 .vh5-scenario p,
    #vhDecisionBoardV5 .vh5-watch-caption,
    #vhDecisionBoardV5 .vh5-impact,
    #vhDecisionBoardV5 .bad,
    #vhDecisionBoardV5 .vh2-status-negative,
    #vhDecisionBoardV5 [class*='risk'] p,
    #vhDecisionBoardV5 [class*='negative'] p{
      font-size:14px !important;
      line-height:1.58 !important;
    }
    #vhDecisionBoardV5 .vh5-stock-chip span{font-size:12.6px !important;}
    #vhDecisionBoardV5 .vh5-stock-chip small{font-size:11.8px !important;}
  }
  `;
  document.head.appendChild(s);
})();
