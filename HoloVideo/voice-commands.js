// Deliberately bounded arithmetic: no eval, code execution, or arbitrary expressions.
function spokenNumber(input){
  let s=input.trim().replace(/-/g,' ').replace(/\band\b/g,'').trim();
  if(/^-?\d+(\.\d+)?$/.test(input.trim()))return Number(input);
  let sign=1;if(s.startsWith('negative ')){sign=-1;s=s.slice(9)}
  const small='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
  const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
  const parts=s.split(' point ');let total=0,group=0;
  for(const word of parts[0].split(/\s+/)){if(/^\d+$/.test(word))group+=Number(word);else if(small.includes(word))group+=small.indexOf(word);else if(tens[word])group+=tens[word];else if(word==='hundred')group=(group||1)*100;else if(word==='thousand'){total+=(group||1)*1000;group=0}else return NaN}
  total+=group;if(parts.length>2)return NaN;
  if(parts[1]){const digits=parts[1].split(' ').map(w=>/^\d$/.test(w)?Number(w):small.indexOf(w));if(digits.some(n=>n<0||n>9))return NaN;total+=Number('0.'+digits.join(''))}
  return sign*total;
}
function arithmetic(text){
  const s=text.toLowerCase().replace(/^(what is|what s|calculate|how much is)\s+/,'').replace(/[?=]/g,'').trim();
  const match=s.match(/^(.+?)\s*(multiplied by|divided by|times|plus|minus|over|\*|×|÷|\+|\/)\s*(.+)$/);
  if(!match)return null;const a=spokenNumber(match[1]),b=spokenNumber(match[3]);if(!Number.isFinite(a)||!Number.isFinite(b))return null;
  const op=match[2];if(['divided by','over','/','÷'].includes(op)&&b===0)return 'Division by zero is undefined.';
  const value=['times','multiplied by','*','×'].includes(op)?a*b:['plus','+'].includes(op)?a+b:op==='minus'?a-b:a/b;
  return Number.isFinite(value)?`${a} ${op} ${b} is ${Number(value.toPrecision(10))}.`:'That result is too large.';
}
let timerDeadline=0,timerPending=false,sleeping=false,sleepResume=false,breathingUntil=0;
function timerDuration(text){const m=text.match(/(?:for\s+)?([\w .-]+?)\s+(seconds?|minutes?|hours?)\b/);if(!m)return NaN;const n=spokenNumber(m[1].replace(/^.*?timer(?: for)?\s+/,''));return n*(m[2].startsWith('hour')?3600:m[2].startsWith('minute')?60:1)}
function endBreathing(){breathingUntil=0;$('breathingGuide').hidden=true}
function setSleeping(value){sleeping=value;$('composition').classList.toggle('sleeping',value);if(value){endBreathing();video.pause()}}
function effectPreset(effect){stopDemo();$('weatherMode').value=effect;save();scene();startAudio()}
async function weatherAnswer(text,generation){
  const city=text.match(/\bin (.+?)(?: tomorrow)?$/)?.[1];
  try{
    if(city){const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:city,count:1,language:'en',format:'json'}),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const p=(await r.json()).results?.[0];if(generation!==replyGeneration)return;if(!p)return say('I could not find that city. Try its full name.');place={name:[p.name,p.admin1,p.country].filter(Boolean).join(', '),latitude:p.latitude,longitude:p.longitude,timezone:p.timezone};weather=null;updated=null;save()}
    if(!place)return say('Choose a city first, or ask for the weather in a city.');
    if(text.includes('tomorrow')){
      const r=await fetch('https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:place.latitude,longitude:place.longitude,daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',timezone:'auto',forecast_days:2}),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const d=(await r.json()).daily;if(generation!==replyGeneration)return;
      if(!d?.time?.[1])throw Error();say(`Tomorrow in ${place.name}: ${description(d.weather_code[1])}. Low ${Math.round(d.temperature_2m_min[1])}, high ${Math.round(d.temperature_2m_max[1])} degrees Celsius. ${d.precipitation_probability_max[1]??'Unknown'} percent chance of precipitation.`);refresh();
    }else{await refresh();if(generation!==replyGeneration)return;say(weather?`${place.name}: ${description(weather.weather_code)}, ${Math.round(weather.temperature_2m)} degrees Celsius.${stale?' These are the last available conditions.':''}`:'Weather is temporarily unavailable. Please try again.')}
  }catch{if(generation===replyGeneration)say('I could not reach the weather service. Please try again.')}finally{hud()}
}
function extraCommand(text){
  const answer=arithmetic(text);if(answer){say(answer);return true}
  if(/\b(cancel|stop) (the )?timer\b/.test(text)){timerDeadline=0;timerPending=false;$('timerDisplay').hidden=true;say('Timer canceled.');return true}
  if(/\b(set|start) (a |the )?timer\b/.test(text)){const seconds=timerDuration(text);if(!Number.isFinite(seconds)||seconds<1||seconds>86400){say('Try set a timer for five minutes. Timers can run from one second to 24 hours.');return true}timerDeadline=Date.now()+seconds*1000;timerPending=false;say(`Timer set for ${seconds} seconds.`);return true}
  if(/\b(time left|timer status)\b/.test(text)){say(timerDeadline?`${Math.max(0,Math.ceil((timerDeadline-Date.now())/1000))} seconds remaining.`:'No timer is running.');return true}
  if(/\b(go to sleep|sleep mode)\b/.test(text)){sleepResume=resumeAfterVoice;resumeAfterVoice=false;setSleeping(true);say('Going to sleep. Say the wake phrase to return.');return true}
  if(/\b(stop breathing|stop the breathing|end breathing)\b/.test(text)){endBreathing();say('Breathing guide stopped.');return true}
  if(/\b(breathe|breath|breathing)\b/.test(text)){breathingUntil=Date.now()+60000;$('breathingGuide').hidden=false;say('Follow the glowing orb. Breathe in for four seconds, then out for six.');return true}
  if(/\b(flip a coin|roll a die|roll the dice|roll a dice)\b/.test(text)){const coin=text.includes('coin'),value=coin?(Math.random()<.5?'Heads':'Tails'):String(1+Math.floor(Math.random()*6));const el=$('chanceResult');el.textContent=coin?(value==='Heads'?'◉ Heads':'◉ Tails'):['','⚀','⚁','⚂','⚃','⚄','⚅'][Number(value)];el.hidden=false;el.classList.remove('toss');void el.offsetWidth;el.classList.add('toss');clearTimeout(chanceTimer);chanceTimer=setTimeout(()=>el.hidden=true,6000);say(coin?value:`You rolled ${value}.`);return true}
  if(/\b(turn around|rotate|mirror)\b/.test(text)){if(text.includes('mirror')){const key=text.includes('vertical')?'mirrorY':'mirrorX';$(key).checked=!$(key).checked}else{$('rotation').value=String((Number($('rotation').value)+(text.includes('turn around')?180:text.includes('left')?270:90))%360)}align();save();say('Video and weather rotated or mirrored together.');return true}
  if(/\b(hide|show) (the )?(clock|weather|overlays)\b/.test(text)){const show=text.startsWith('show'),target=text.includes('clock')?'clock':text.includes('weather')?'weatherLabel':null;if(target){$(target).hidden=!show;if(show)$('showHud').checked=true}else{$('showHud').checked=show;if(show){$('clock').hidden=false;$('weatherLabel').hidden=false}}save();align();say(show?'Overlay shown.':'Overlay hidden.');return true}
  if(text.includes('spooky')){$('ambient').checked=true;effectPreset('fog');$('composition').classList.add('spooky');say('Spooky atmosphere enabled.');return true}
  if(text.includes('winter')){effectPreset('snow');const i=tracks.findIndex(t=>rules[t.src]==='snow');if(i>=0)load(i,resumeAfterVoice);say(i>=0?'Winter scene enabled.':'Snow enabled. Assign a snow scene to a video to use it for winter.');return true}
  if(/\b(more|less|heavier|lighter) rain\b/.test(text)){effectPreset('rain');$('intensity').value=String(Math.max(.1,Math.min(2,Number($('intensity').value)+(/more|heavier/.test(text)?.3:-.3))));save();say('Rain intensity adjusted.');return true}
  if(/\b(tomorrow|weather in|temperature in)\b/.test(text)){weatherAnswer(text,replyGeneration);return true}
  if(/\b(about yourself|who are you|illusion)\b/.test(text)){say('I am Pepper, your hologram companion. This display uses Pepper’s ghost: light reflected in an angled transparent surface makes an image appear to float. Ask me for weather, a timer, arithmetic, or a new atmosphere.');return true}
  if(text.includes('joke')){const jokes=['Why did the ghost go to the party? For the boos.','Why did the cloud stay home? It was feeling under the weather.','What is a ghost’s favorite dessert? I scream.','Why was the math book sad? It had too many problems.'];say(jokes[Math.floor(Math.random()*jokes.length)]);return true}
  if(/\b(help|commands|what can you do)\b/.test(text)){say('Try two times two, set a timer for five minutes, weather in Chicago, rain tomorrow, spooky atmosphere, show me winter, more rain, turn around, hide the clock, flip a coin, breathe with me, or go to sleep.');return true}
  return false;
}
let chanceTimer;
setInterval(()=>{
  if(timerDeadline){const left=Math.ceil((timerDeadline-Date.now())/1000);$('timerDisplay').hidden=false;$('timerDisplay').textContent=left>0?'Timer '+format(left):'Timer complete';if(left<=0){timerDeadline=0;timerPending=true}}
  if(timerPending&&!voiceSession&&!speaking&&!processing&&!document.hidden){timerPending=false;beginVoice();say('Your timer is complete.')}
  if(breathingUntil){if(Date.now()>=breathingUntil)endBreathing();else{$('breathingGuide').textContent=(Date.now()-(breathingUntil-60000))%10000<4000?'Breathe in':'Breathe out'}}
},250);
