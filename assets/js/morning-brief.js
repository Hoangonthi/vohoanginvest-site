import { esc, fmt, pct, fetchMarket, marketContext, supabaseClient, trackTool } from './investor-hub-shared.js';
const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
function insight(tone,title,text){return `<div class="ih-insight ${tone}"><b>${esc(title)}</b><p>${esc(text)}</p></div>`}
function level(score){const s=Number(score)||0;return s>=72?1:s>=58?2:s>=46?3:s>=32?4:5}
function render(market,journal){setText('marketState',market.state?.label||'—');setText('marketScore',`${market.state?.score??'—'}/100`);setText('vnChange',pct(market.vnChange));setText('vnValue',market.vnIndex===null?'—':`VN-Index ${fmt(market.vnIndex,2)}`);setText('breadthLabel',market.breadth?.label||'—');setText('breadthSub',market.breadth?.adv==null?'—':`${market.breadth.adv} tăng · ${market.breadth.flat} TC · ${market.breadth.dec} giảm`);setText('leaderName',market.leader?.name||'—');setText('leaderSub',market.leader?pct(market.leader.change_pct):'—');const marketLive = document.getElementById('marketLive');

if (marketLive) {
  marketLive.innerHTML =
    `<b>${esc(market.freshness?.label || 'Dữ liệu gần nhất')}</b> · ${esc(market.state?.label || '—')} ${market.state?.score ?? '—'}/100`;
}
const risk=level(market.state?.score);const watch=[];watch.push(insight('warning','Độ rộng có cải thiện không?',market.breadth?.balance!=null&&market.breadth.balance<0?'Số mã giảm đang nhiều hơn số mã tăng. Nếu độ rộng tiếp tục yếu, chỉ số hồi chưa đủ để kết luận rủi ro giảm.':'Theo dõi xem số mã tăng có tiếp tục lan tỏa hay chỉ tập trung ở vài nhóm.'));watch.push(insight('warning','Dòng tiền có xác nhận không?',market.flow?.same_time_ratio!=null?`GT hiện tại đang ở khoảng ${Math.round(Number(market.flow.same_time_ratio)*100)}% trung bình cùng thời điểm. Cần nhìn cả giá và độ rộng, không dùng thanh khoản một mình.`:'Chuẩn cùng thời điểm đang tích lũy. Tạm thời ưu tiên nhịp GT 15 phút và sự lan tỏa của ngành.'));watch.push(insight('warning','Nhóm dẫn dắt có giữ sức mạnh?',market.leader?`${market.leader.name} đang dẫn dắt ${pct(market.leader.change_pct)}. Nếu nhóm dẫn dắt mất sức mạnh nhanh, trạng thái chung có thể đổi trước khi chỉ số thể hiện rõ.`:'Chưa có nhóm dẫn dắt rõ. Ưu tiên quan sát hơn là ép tìm cơ hội.'));document.getElementById('watchBox').innerHTML=watch.join('');
const changes=[];if(risk>=4){changes.push(insight('positive','Muốn nâng quan điểm', 'Cần đồng thời thấy Market Score cải thiện, độ rộng bớt âm và nhóm dẫn dắt duy trì sức mạnh. Một nhịp kéo chỉ số đơn lẻ là chưa đủ.'));changes.push(insight('danger','Muốn hạ quan điểm thêm','Nếu Market Score giảm thêm, số mã giảm tiếp tục áp đảo và GT tăng trong lúc giá/độ rộng yếu, ưu tiên bảo toàn vốn.'));}else{changes.push(insight('positive','Muốn giữ quan điểm tích cực','Cần độ rộng và nhóm dẫn dắt tiếp tục xác nhận, không chỉ VN-Index xanh.'));changes.push(insight('warning','Dấu hiệu phải thận trọng hơn','Market Score giảm nhanh, độ rộng xấu đi hoặc nhóm dẫn dắt đảo chiều là lý do giảm mức chấp nhận rủi ro.'));}document.getElementById('changeBox').innerHTML=changes.join('');
const avoid=[];if(risk>=4){avoid.push(insight('danger','Không mua đuổi để “gỡ cơ hội”','Trạng thái đang thận trọng/rủi ro. Nếu mở vị thế, quy mô phải nhỏ và có điều kiện sai rõ ràng.'));avoid.push(insight('danger','Không tăng margin chỉ vì một nhịp hồi','Đòn bẩy nên đi sau xác nhận của thị trường, không đi trước nó.'));}else{avoid.push(insight('warning','Không coi xanh là tín hiệu mua','Chỉ mua khi mã, ngành, điểm mua và mức rủi ro đều đạt chuẩn.'));avoid.push(insight('warning','Không mở quá nhiều vị thế cùng lúc','Thị trường tốt không làm mất đi giới hạn rủi ro của tài khoản.'));}document.getElementById('avoidBox').innerHTML=avoid.join('');
let vh='Tôi không cố đoán thị trường sẽ đi bao nhiêu điểm.';let vhText='Điều tôi quan tâm là các điều kiện có đang đồng thuận hay không: độ rộng, dòng tiền, nhóm dẫn dắt và mức rủi ro của từng tài khoản.';if(risk>=4){vh='Ở trạng thái này, tôi quan tâm bảo toàn vốn hơn dự đoán đáy.';vhText='Nếu độ rộng chưa cải thiện và dòng tiền chưa xác nhận, việc đúng nhất thường là giữ dư địa. Cơ hội thật không cần phải mua bằng mọi giá.'}else if(risk<=2){vh='Thị trường tích cực vẫn cần kỷ luật từng lệnh.';vhText='Tôi quan tâm liệu sức mạnh có lan tỏa và vị thế mới có mức cắt lỗ rõ hay không. Chỉ số xanh không thay thế được quản trị rủi ro.'}setText('viewHeadline',vh);setText('viewText',vhText);trackTool('MORNING_BRIEF','VIEW',{resultCode:String(market.state?.label||'UNKNOWN'),score:market.state?.score??null,metadata:{journalDays:journal?.days?.length||0}})}
async function init(){
  try{
    const market = marketContext(await fetchMarket());

    let journal = {};

    try{
      const { data } = await supabaseClient.rpc(
        'public_market_journal_v1',
        { p_days: 5 }
      );

      journal = data?.journal || data || {};
    }catch{}

    render(market, journal);

  }catch(error){

    console.error('Morning Brief error:', error);

    setText(
      'marketLive',
      'Chưa cập nhật được dữ liệu thị trường'
    );
  }
}
init();
