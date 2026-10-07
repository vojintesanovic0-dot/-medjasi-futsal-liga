/* Medjasi V13 UI normalizer: removes decorative leading emoji from UI only. */
(()=>{"use strict";
const skip=[".fan-emoji-bar",".fan-emoji-hint",".fan-chat-emoji-host",".v9-reaction",".chat-message",".chat-composer",".v9-post-caption",".v9-story-caption",".v9-comment",".community-poll","[contenteditable='true']"];
const rx=/^\s*[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u;
const selectors=".section-title,.hero-kicker,.v10-eyebrow,.v10-card-head h2,.v10-section-heading h2,.v10-bottom-grid h2,.v10-media-strip h2,.v10-music-card h2,#stats .card h3,#login .card h2,#login .btn,#comments .btn,#chat .chat-header strong,#commentLoginText,#chatLoginText,.account-name,.account-login-btn,.v13-login,.account-edit-btn,.notification-title,.notification-icon,.gallery-overlay,.admin-card-head h3,.admin-organizer-tab,.graphic-engine-actions .btn,.music-placeholder,.music-actions .btn,.stat-label,.admin-pill";
function skipEl(el){return skip.some(s=>{try{return el.matches?.(s)||el.closest?.(s)}catch{return false}})}
function clean(el){if(!(el instanceof HTMLElement)||skipEl(el))return;if(el.matches(".notification-icon")){el.textContent="";el.classList.add("v13-ui-clean");return}const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);for(const n of nodes){if(skipEl(n.parentElement))continue;const v=n.nodeValue.replace(rx,"");if(v!==n.nodeValue)n.nodeValue=v}el.classList.add("v13-ui-clean")}
function scan(root=document){if(root instanceof HTMLElement)clean(root);root.querySelectorAll?.(selectors).forEach(clean)}
function start(){scan();if(document.body)new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>n.nodeType===1&&scan(n)))).observe(document.body,{childList:true,subtree:true})}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();