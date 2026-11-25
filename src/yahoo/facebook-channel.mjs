/* Facebook in the Yahoo desktop on Zalo: a dark-blue buddy window fed by the Facebook Messages
   tab (adapters/facebook) and Yahoo chat windows mirroring the conversation open there
   (source-channel.mjs does the work; this file gives Facebook's words and groups). */
import {hostSource} from './source-channel.mjs';

export const FACEBOOK_ICON='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#1b3f8f"/><text x="9" y="13.5" font-family="Arial" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle">f</text></svg>');

export function hostFacebook(root){
  return hostSource(root,{id:'facebook',label:'Facebook',icon:FACEBOOK_ICON,tab:'tab Facebook Messages',
    // A Messages tab open since before the plugin was installed, updated or reloaded runs without it
    // until reloaded: the plugin has no access to find or reach that tab itself (no facebook.com host
    // permission, so no way near Facebook's cookies either).
    oldTab:'Đã mở tab Messages từ trước khi cài hay cập nhật plugin? Bấm F5 trên tab đó.',
    hint:'Hội thoại trên tab Facebook Messages',search:'Tìm hội thoại Facebook...',
    groups:{group:'Group',friends:'Friends',business:'Page'},businessTitle:'Trang Facebook',calls:true,photosClass:'ym-fb-photos',
    status:{closed:'Chưa mở Facebook Messages — bấm để mở (tab chạy nền). Đã mở tab Messages từ trước khi cài hay cập nhật plugin? Bấm F5 trên tab đó.',unrecognized:'Tab Facebook không ở trang Messages — bấm để xem tab'}});
}
