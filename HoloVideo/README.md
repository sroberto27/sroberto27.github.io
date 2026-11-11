# Pepper hologram studio

## Voice commands

After “Hey Jhon” (or your configured phrase), try:

- “What is two times two?” Basic two-operand addition, subtraction, multiplication, and division, including spoken numbers and decimals. No general algebra or arbitrary code evaluation.
- “Set a timer for five minutes,” “timer status,” or “cancel timer.” One timer, up to 24 hours. Keep the page open; suspended phones can delay announcements.
- “Weather in Chicago” or “will it rain tomorrow?” City queries select the first search match and read its full name; refine the city query if needed. Forecasts use Open-Meteo daily data, https://open-meteo.com/en/docs.
- “Spooky atmosphere,” “show me winter,” “more rain,” or “less rain.” Assign the snow scene rule to a video for automatic winter selection.
- “Turn around” (180 degrees), “rotate left/right” (90 degrees), “mirror the display,” or “mirror vertically.” Weather, video, clock, orb, and new overlays all transform together.
- “Hide/show the clock,” “hide/show the weather,” or “hide/show overlays.”
- “Tell me about yourself,” “tell me a joke,” or “help.”
- “Flip a coin” or “roll a die.” A short visual animation accompanies the spoken result.
- “Breathe with me” starts a 60-second visual guide (four seconds in, six out). “Stop breathing” ends the guide.
- “Go to sleep” fades the composition to black and pauses playback; the configured wake phrase restores it. This does not lock the phone or disable microphone recognition.

All replies are text plus browser speech synthesis where supported. The assistant is a set of local commands, not a general-purpose AI chatbot. Weather queries need internet; the other commands require no external AI service.

Weather rendering now uses resolution-aware layered rain, surface ripples, depth-varied snow, drifting fog/clouds, wind-driven leaves, stationary night stars, daytime glow, and randomized branching lightning. Lightning remains opt-in and is suppressed for reduced-motion preferences.

Voice activation also accepts **hey jhon** and **hey john** by default (editable aliases). It temporarily pauses a playing video, displays a wave-filled orb while listening, and floats the orb during a short reply-preparation transition. Replies appear inside the display as text and are also spoken with the browser's available voice. Playback resumes on reply completion or listening timeout; explicit pause/stop commands keep it paused. Already-paused videos remain paused. The floating animation indicates preparation of a local scripted response, not an external AI model.

A buildless GitHub Pages app. Open the deployed `/HoloVideo/` page, tap **Start display mode**, and grant microphone permission separately in Voice if desired. Default activation phrase: **hey jhon pepper**. Change it or add aliases in Voice. No YouTube integration or API keys.

## Local preview

Run `python -m http.server 8080` from this folder and open http://localhost:8080. Use HTTPS (GitHub Pages) on the phone for microphone, location, and wake lock. A plain HTTP LAN address may not support those capabilities.

## Adding videos

Put MP4 files in `videos/`, then run `node scripts/generate-playlist.mjs` and commit the videos and generated `videos.json` alongside this app. The generator also includes the existing root video. Device uploads are temporary browser object URLs, not uploaded to a server. Prefer H.264/AAC MP4 for phone compatibility.

This folder belongs to an existing GitHub Pages repository. Publish these files using that repository's existing deployment process; no separate Sites hosting or backend is required. The app uses relative asset paths. This implementation does not change the parent repository's workflows.

## Features

- Playlist, repeat, shuffle, seek, volume, and device video selection.
- Fullscreen composition with full-window fallback; 90-degree rotation, mirror, scale, offsets, alignment guides, saved settings.
- Open-Meteo city search and weather; optional geolocation. Selected city's local clock. Weather refresh every 15 minutes; failed refreshes retain and label old data.
- Rain intensity from reported precipitation, storm lightning (opt-in), snow, fog, wind, stars; manual effects and 12-second demo cycle.
- Per-video weather/night scene rules; optional procedural ambient audio with speech ducking.
- Wake phrase gates one command for eight seconds. Listening and speaking orb. Supported commands are listed in the UI. This is a fixed command assistant, not an LLM.
- Screen Wake Lock requested during display mode and reacquired on foreground return where supported.

## Browser limits

Keep the phone powered with the page visible. A website cannot override the power button, OS battery policies, or guarantee unlimited microphone sessions. Initial playback/fullscreen/audio require a user gesture. Voice support varies and browser speech services may process audio remotely. Disable voice to stop microphone recognition. Speech recognition can mishear a wake phrase; it is not authentication. Some phones reserve volume control for hardware buttons. The controls remain usable when voice is unsupported.

Weather requires internet and Open-Meteo availability. Personal noncommercial use of its free API requires no key. Weather effects are artistic simulations, not live lightning detection. Fonts use Google Fonts with system fallbacks. Nothing automatically publishes or uploads device videos.
