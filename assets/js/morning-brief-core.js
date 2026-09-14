import {
  esc,
  fmt,
  pct,
  fetchMarket,
  marketContext,
  supabaseClient,
  trackTool
} from './investor-hub-shared.js';


/* =========================================================
   DOM HELPERS
========================================================= */

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

const setHTML = (id, html) => {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
};


/* =========================================================
   UI HELPERS
========================================================= */

function insight(tone, title, text) {
  return `
    <div class="ih-insight ${tone}">
      <b>${esc(title)}</b>
      <p>${esc(text)}</p>
    </div>
  `;
}


/* =========================================================
   MARKET RISK LEVEL
   1 = rất tích cực
   5 = rủi ro rất cao
========================================================= */

function level(score) {
  const s = Number(score) || 0;

  if (s >= 72) return 1;
  if (s >= 58) return 2;
  if (s >= 46) return 3;
  if (s >= 32) return 4;

  return 5;
}


/* =========================================================
   MAIN RENDER
========================================================= */

function render(market, journal) {

  /* -------------------------------------------------------
     1. MARKET SUMMARY
  ------------------------------------------------------- */

  setText(
    'marketState',
    market.state?.label || '—'
  );

  setText(
    'marketScore',
    `${market.state?.score ?? '—'}/100`
  );

  setText(
    'vnChange',
    pct(market.vnChange)
  );

  setText(
    'vnValue',
    market.vnIndex == null
      ? '—'
      : `VN-Index ${fmt(market.vnIndex, 2)}`
  );

  setText(
    'breadthLabel',
    market.breadth?.label || '—'
  );

  setText(
    'breadthSub',
    market.breadth?.adv == null
      ? '—'
      : `${market.breadth.adv} tăng · ${market.breadth.flat ?? 0} TC · ${market.breadth.dec ?? 0} giảm`
  );

  setText(
    'leaderName',
    market.leader?.name || '—'
  );

  setText(
    'leaderSub',
    market.leader
      ? pct(market.leader.change_pct)
      : '—'
  );


  /* Market Live có thể không tồn tại trong UI mới */
  const marketLive = document.getElementById('marketLive');

  if (marketLive) {
    marketLive.innerHTML = `
      <b>${esc(market.freshness?.label || 'Dữ liệu gần nhất')}</b>
      ·
      ${esc(market.state?.label || '—')}
      ${market.state?.score ?? '—'}/100
    `;
  }


  /* -------------------------------------------------------
     2. PHÂN LOẠI BỐI CẢNH
  ------------------------------------------------------- */

  const risk = level(market.state?.score);

  const adv = Number(market.breadth?.adv ?? 0);
  const dec = Number(market.breadth?.dec ?? 0);
  const breadthBalance = Number(market.breadth?.balance);

  const breadthWeak =
    Number.isFinite(breadthBalance)
      ? breadthBalance < 0
      : dec > adv;

  const breadthVeryWeak =
    dec > 0 && adv > 0 && dec >= adv * 1.8;

  const flowRatio =
    market.flow?.same_time_ratio == null
      ? null
      : Number(market.flow.same_time_ratio);

  const flowWeak =
    flowRatio != null &&
    Number.isFinite(flowRatio) &&
    flowRatio < 0.8;

  const flowStrong =
    flowRatio != null &&
    Number.isFinite(flowRatio) &&
    flowRatio >= 1;

  const leaderChange =
    market.leader?.change_pct == null
      ? null
      : Number(market.leader.change_pct);

  const leaderStrong =
    leaderChange != null &&
    Number.isFinite(leaderChange) &&
    leaderChange > 0;

  const leaderWeak =
    leaderChange != null &&
    Number.isFinite(leaderChange) &&
    leaderChange <= 0;


  /* =======================================================
     3. BA ĐIỀU CẦN NHÌN
  ======================================================= */

  const watch = [];


  /* ĐỘ RỘNG */
  if (breadthVeryWeak) {

    watch.push(
      insight(
        'danger',
        'Độ rộng thị trường đang phát tín hiệu cảnh báo',
        `Số mã giảm đang áp đảo rõ rệt số mã tăng. Trong trạng thái này, diễn biến của chỉ số có thể chưa phản ánh đầy đủ mức độ suy yếu bên dưới thị trường.`
      )
    );

  } else if (breadthWeak) {

    watch.push(
      insight(
        'warning',
        'Độ rộng cần thêm sự cải thiện',
        `Số mã giảm vẫn chiếm ưu thế. Một nhịp hồi của VN-Index chỉ đáng tin cậy hơn khi độ rộng đồng thời được cải thiện.`
      )
    );

  } else {

    watch.push(
      insight(
        'positive',
        'Độ rộng đang có sự cải thiện',
        `Dòng tăng đang có mức lan tỏa tốt hơn. Cần tiếp tục quan sát xem sự cải thiện này có được duy trì và mở rộng sang nhiều nhóm ngành hay không.`
      )
    );
  }


  /* DÒNG TIỀN */
  if (flowRatio != null && Number.isFinite(flowRatio)) {

    const flowPercent = Math.round(flowRatio * 100);

    if (flowWeak) {

      watch.push(
        insight(
          'warning',
          'Dòng tiền chưa xác nhận rõ',
          `Giá trị giao dịch hiện ở khoảng ${flowPercent}% mức trung bình cùng thời điểm. Thanh khoản còn thấp nên cần thận trọng với những nhịp tăng thiếu sự xác nhận của dòng tiền.`
        )
      );

    } else if (flowStrong) {

      watch.push(
        insight(
          'positive',
          'Dòng tiền đang cải thiện',
          `Giá trị giao dịch hiện ở khoảng ${flowPercent}% mức trung bình cùng thời điểm. Điều quan trọng tiếp theo là dòng tiền có lan tỏa cùng độ rộng và nhóm dẫn dắt hay không.`
        )
      );

    } else {

      watch.push(
        insight(
          'warning',
          'Dòng tiền đang ở vùng cần theo dõi',
          `Giá trị giao dịch hiện ở khoảng ${flowPercent}% mức trung bình cùng thời điểm. Cần nhìn đồng thời giá, độ rộng và sự lan tỏa thay vì sử dụng thanh khoản như một tín hiệu độc lập.`
        )
      );
    }

  } else {

    watch.push(
      insight(
        'warning',
        'Dòng tiền cần thêm dữ liệu xác nhận',
        'Dữ liệu chuẩn cùng thời điểm chưa đầy đủ. Tạm thời ưu tiên quan sát diễn biến giá, độ rộng và sự lan tỏa giữa các nhóm ngành.'
      )
    );
  }


  /* NHÓM DẪN DẮT */
  if (market.leader && leaderStrong) {

    watch.push(
      insight(
        'positive',
        'Nhóm dẫn dắt vẫn đang duy trì sức mạnh',
        `${market.leader.name} đang là nhóm nổi bật với mức biến động ${pct(market.leader.change_pct)}. Cần theo dõi khả năng duy trì sức mạnh và mức độ lan tỏa sang các nhóm còn lại.`
      )
    );

  } else if (market.leader && leaderWeak) {

    watch.push(
      insight(
        'warning',
        'Nhóm dẫn dắt đang suy yếu',
        `${market.leader.name} hiện chưa duy trì được động lượng tích cực. Nếu nhóm dẫn dắt tiếp tục suy yếu, trạng thái chung có thể xấu đi trước khi VN-Index thể hiện rõ.`
      )
    );

  } else {

    watch.push(
      insight(
        'warning',
        'Chưa hình thành nhóm dẫn dắt rõ ràng',
        'Khi thị trường chưa có nhóm dẫn dắt đủ mạnh, ưu tiên quan sát chất lượng dòng tiền thay vì cố tìm kiếm cơ hội bằng mọi giá.'
      )
    );
  }


  setHTML(
    'watchBox',
    watch.join('')
  );


  /* =======================================================
     4. ĐIỀU KIỆN THAY ĐỔI QUAN ĐIỂM
  ======================================================= */

  const changes = [];


  /* RỦI RO CAO */
  if (risk >= 4) {

    setText(
      'changeHeadline',
      'Ưu tiên bảo toàn vốn cho đến khi dữ liệu xác nhận cải thiện'
    );


    let improveText =
      'Chỉ nâng mức độ tích cực khi Market Score (Điểm trạng thái thị trường) cải thiện, độ rộng thu hẹp đà tiêu cực và nhóm dẫn dắt duy trì được sức mạnh. Một nhịp kéo chỉ số đơn lẻ chưa đủ cơ sở để tăng mức chấp nhận rủi ro.';

    if (breadthVeryWeak) {
      improveText =
        'Điều kiện quan trọng đầu tiên là độ rộng phải cải thiện rõ, số mã giảm không còn áp đảo và Market Score phục hồi. Chỉ số hồi trong khi phần lớn cổ phiếu vẫn suy yếu chưa phải tín hiệu đủ mạnh để thay đổi quan điểm.';
    }

    if (flowWeak) {
      improveText +=
        ' Đồng thời, dòng tiền cần cải thiện để xác nhận rằng lực cầu thực sự quay lại thị trường.';
    }

    changes.push(
      insight(
        'positive',
        'Điều kiện nâng đánh giá thị trường',
        improveText
      )
    );


    let lowerText =
      'Nếu Market Score (Điểm trạng thái thị trường) tiếp tục suy giảm, số mã giảm vẫn áp đảo và các nhóm dẫn dắt mất thêm sức mạnh, ưu tiên giảm mức chấp nhận rủi ro và bảo toàn vốn.';

    if (flowStrong && breadthWeak) {
      lowerText =
        'Nếu thanh khoản tăng trong khi độ rộng và giá tiếp tục suy yếu, đây là tín hiệu cần đặc biệt thận trọng. Khi dòng tiền lớn xuất hiện nhưng bên bán vẫn chiếm ưu thế, ưu tiên bảo toàn vốn hơn tìm kiếm lợi nhuận ngắn hạn.';
    }

    changes.push(
      insight(
        'danger',
        'Điều kiện hạ đánh giá thị trường',
        lowerText
      )
    );
  }


  /* TRUNG TÍNH */
  else if (risk === 3) {

    setText(
      'changeHeadline',
      'Thị trường đang ở vùng cần thêm tín hiệu xác nhận'
    );

    changes.push(
      insight(
        'positive',
        'Điều kiện chuyển sang tích cực',
        'Cần thấy Market Score (Điểm trạng thái thị trường) cải thiện rõ hơn, độ rộng chuyển biến tích cực, nhóm dẫn dắt giữ được sức mạnh và dòng tiền có mức lan tỏa tốt hơn. Sự đồng thuận giữa các tín hiệu quan trọng hơn một phiên tăng điểm đơn lẻ.'
      )
    );

    changes.push(
      insight(
        'warning',
        'Điều kiện chuyển sang thận trọng',
        'Nếu Market Score (Điểm trạng thái thị trường) suy yếu trở lại, độ rộng xấu đi hoặc nhóm dẫn dắt mất sức mạnh, cần chủ động giảm mức chấp nhận rủi ro thay vì chờ chỉ số xác nhận muộn.'
      )
    );
  }


  /* THỊ TRƯỜNG TÍCH CỰC */
  else {

    setText(
      'changeHeadline',
      'Xu hướng tích cực nhưng vẫn cần dữ liệu duy trì sự xác nhận'
    );

    changes.push(
      insight(
        'positive',
        'Điều kiện duy trì đánh giá tích cực',
        'Market Score (Điểm trạng thái thị trường) cần duy trì ở vùng tích cực, độ rộng tiếp tục lan tỏa và nhóm dẫn dắt giữ được sức mạnh. Thanh khoản nên đồng thuận với diễn biến giá để xu hướng có độ tin cậy cao hơn.'
      )
    );

    changes.push(
      insight(
        'warning',
        'Tín hiệu cần hạ mức chấp nhận rủi ro',
        'Nếu Market Score (Điểm trạng thái thị trường) giảm nhanh, độ rộng thu hẹp, dòng tiền suy yếu hoặc nhóm dẫn dắt đảo chiều, cần giảm tỷ trọng chủ động thay vì chờ VN-Index phát tín hiệu muộn.'
      )
    );
  }


  setHTML(
    'changeBox',
    changes.join('')
  );


  /* =======================================================
     5. KHÔNG NÊN LÀM SÁNG NAY
  ======================================================= */

  const avoid = [];


  if (risk >= 4) {

    avoid.push(
      insight(
        'danger',
        'Không mua đuổi để tìm kiếm một nhịp hồi',
        'Trong trạng thái rủi ro cao, ưu tiên chất lượng điểm mua và khả năng kiểm soát thua lỗ. Nếu mở vị thế mới, quy mô cần nhỏ và điều kiện sai phải được xác định trước.'
      )
    );

    avoid.push(
      insight(
        'danger',
        'Không gia tăng đòn bẩy trước khi thị trường xác nhận',
        'Margin nên được sử dụng sau khi thị trường chứng minh được sức mạnh, không dùng đòn bẩy để đặt cược rằng thị trường sẽ sớm hồi phục.'
      )
    );

  } else if (risk === 3) {

    avoid.push(
      insight(
        'warning',
        'Không vội tăng tỷ trọng khi tín hiệu chưa đồng thuận',
        'Thị trường đang ở trạng thái chuyển tiếp. Chỉ nên tăng mức chấp nhận rủi ro khi điểm số, độ rộng, dòng tiền và nhóm dẫn dắt cùng cải thiện.'
      )
    );

    avoid.push(
      insight(
        'warning',
        'Không biến một phiên tăng thành kết luận xu hướng',
        'Một phiên tích cực chưa đủ để xác nhận xu hướng nếu thiếu sự lan tỏa và dòng tiền hỗ trợ.'
      )
    );

  } else {

    avoid.push(
      insight(
        'warning',
        'Không coi thị trường xanh là tín hiệu mua',
        'Chỉ mở vị thế khi cổ phiếu, ngành, điểm mua và mức rủi ro đều đáp ứng tiêu chuẩn của kế hoạch giao dịch.'
      )
    );

    avoid.push(
      insight(
        'warning',
        'Không mở quá nhiều vị thế cùng lúc',
        'Thị trường thuận lợi không làm mất đi giới hạn rủi ro của tài khoản. Quy mô vị thế vẫn phải nằm trong kế hoạch quản trị vốn.'
      )
    );
  }


  setHTML(
    'avoidBox',
    avoid.join('')
  );


  /* =======================================================
     6. CÁCH VÕ HOÀNG NHÌN
  ======================================================= */

  let vhHeadline =
    'Tôi không cố dự đoán thị trường sẽ đi bao nhiêu điểm.';

  let vhText =
    'Điều quan trọng là các tín hiệu có đang đồng thuận hay không: độ rộng, dòng tiền, nhóm dẫn dắt và mức rủi ro. Quyết định chỉ nên thay đổi khi dữ liệu thay đổi.';


  if (risk >= 4) {

    vhHeadline =
      'Ở trạng thái này, bảo toàn vốn quan trọng hơn dự đoán đáy.';

    vhText =
      'Khi độ rộng chưa cải thiện và dòng tiền chưa xác nhận, ưu tiên giữ dư địa xử lý. Thị trường luôn còn cơ hội mới, nhưng vốn mất đi sẽ làm giảm khả năng tận dụng cơ hội đó.';

  } else if (risk === 3) {

    vhHeadline =
      'Chưa cần vội chọn hướng khi các tín hiệu chưa đồng thuận.';

    vhText =
      'Giai đoạn chuyển tiếp cần quan sát nhiều hơn hành động. Tôi muốn thấy điểm số, độ rộng, dòng tiền và nhóm dẫn dắt cùng xác nhận trước khi nâng mức chấp nhận rủi ro.';

  } else if (risk <= 2) {

    vhHeadline =
      'Thị trường tích cực vẫn cần kỷ luật ở từng vị thế.';

    vhText =
      'Khi bối cảnh thuận lợi, trọng tâm chuyển từ phòng thủ sang lựa chọn cổ phiếu và điểm vào. Tuy nhiên, mỗi vị thế vẫn phải có mức rủi ro rõ ràng và nằm trong giới hạn của tài khoản.';
  }


  setText(
    'viewHeadline',
    vhHeadline
  );

  setText(
    'viewText',
    vhText
  );


  /* =======================================================
     7. TRACKING
  ======================================================= */

  trackTool(
    'MORNING_BRIEF',
    'VIEW',
    {
      resultCode: String(
        market.state?.label || 'UNKNOWN'
      ),

      score:
        market.state?.score ?? null,

      metadata: {
        journalDays:
          journal?.days?.length || 0,

        riskLevel:
          risk,

        breadthWeak:
          breadthWeak,

        flowRatio:
          flowRatio,

        leader:
          market.leader?.name || null
      }
    }
  );
}


/* =========================================================
   INIT
========================================================= */

async function init() {

  try {

    const rawMarket = await fetchMarket();

    const market =
      marketContext(rawMarket);

    let journal = {};


    try {

      const { data } =
        await supabaseClient.rpc(
          'public_market_journal_v1',
          {
            p_days: 5
          }
        );

      journal =
        data?.journal ||
        data ||
        {};

    } catch (journalError) {

      console.warn(
        'Morning Brief journal:',
        journalError
      );
    }


    render(
      market,
      journal
    );


  } catch (error) {

    console.error(
      'Morning Brief error:',
      error
    );

    setText(
      'marketLive',
      'Chưa cập nhật được dữ liệu thị trường'
    );
  }
}


/* =========================================================
   START
========================================================= */

init();
