# Death Valley Experience — information needed from LSU

**What this is:** the app is built and working, but it is currently running on
placeholder content — invented times, a "TBD" opponent, and blank phone numbers.
Before it can be put in front of a real recruit, and before we build the tool
that lets your staff edit it themselves, we need answers to the questions below.

**How to use it:** you do not need to answer everything, and you do not need to
answer in order. Sections 1–3 are the ones that block a real gameday. Everything
else shapes the editing tool we build afterwards.

Answers can be rough. "Usually about 45 minutes but it slips" is more useful
than a precise number that isn't true.

---

## What exists today

A web app, live at `https://sroberto27.github.io/Wrapper/map/LSU3D/`, showing a
map of the gameday footprint and a ten-stop journey: Lot 414 arrival → charter
bus → Football Operations Facility → indoor tailgate → registration → Tiger Walk
→ Lawton Room → field-level warmups → kickoff → postgame at Nicholson Gateway.

It already supports:

- A personalised schedule per visit, opened from a link (times, instructions,
  who to call, progress through the day)
- A walking mode for use during the visit, with "you are here" on the map
- Links and QR codes that open a specific stop
- A full-screen looping display for an office or the Lawton Room

All of it is running on made-up content.

---

## 1. The gameday schedule — *blocks a real visit*

This is the single most important section. Everything else can wait.

1. **Can we have one real gameday schedule, exactly as it is given to families
   today?** A photo of the printed sheet or the graphic is perfect. We do not
   need it typed up.
2. **How many home gamedays host recruit visits in a season?**
3. **How many recruits and family members on a typical gameday?**
4. **Does everyone follow the same schedule, or do groups split?** For example,
   do official and unofficial visitors do different things, or do large groups
   run in waves? *This decides whether the app stores one schedule per gameday
   or several, which is hard to change later.*
5. **How far ahead is the schedule finalised?**
6. **What changes on the day itself, and how often?** Kickoff moving for TV,
   weather, a room change. *This decides whether staff need to edit from a phone
   during the visit or only from a desk beforehand.*
7. **Who currently writes and distributes this schedule, and in what
   program?** Word, Canva, a graphic designer?

## 2. Who a family calls — *blocks a real visit*

8. **During the visit, who does a family call if they get lost or separated?**
9. **Is that a role or a specific person?** For example "Recruiting Operations"
   versus a named staff member.
10. **Which phone number can we show, and may it be public?**

    **This one matters more than it looks.** The app is a public website. Any
    number we put in it can be read by anyone who finds the page, and it stays
    in the published history permanently. We would strongly prefer a published
    office or department line rather than anyone's personal mobile.

    If a family genuinely needs a direct mobile number, tell us — that is
    workable, but it requires the login-protected version described in §8, and
    it changes the build.

## 3. The stops on the map — *blocks a real visit*

Several stop positions came from public information and desk research, not from
you. Four are marked in our notes as needing confirmation:

11. **Lot 414** — where exactly do families park, and where do the buses stage
    inside the lot?
12. **Registration** — which room, and in which building?
13. **Tiger Walk** — where do guests gather or get dropped off?
14. **Field level** — which gate or tunnel do guests use?
15. **Are the ten stops correct, in the right order?** Is anything missing, and
    does anything happen that we have not represented?
16. **Do the stops change between gamedays**, or is the route the same every
    time?

## 4. Photos and video

The app currently shows a grey placeholder box wherever a photo should be.

17. **Are there existing approved photos of each stop we may use?**
18. **Who owns them and who approves their use?**
19. **Is there video** — a Tiger Walk clip, a stadium flyover — that should
    appear?
20. **Is there anything we must not show?**

## 5. The immersive tour

The app is already wired for a 360° walkthrough (the "Treedis" experience) but
no capture exists, so that button is hidden everywhere.

21. **Does a 360° capture of any of these spaces already exist?**
22. **If not, is one planned or budgeted?** *If the answer is no, we should
    remove the placeholder wiring rather than leave a hidden feature in the
    code.*

## 6. Who edits the content — *shapes the editing tool*

Right now, changing any text means a developer editing a file. The next phase
replaces that with a tool your staff use directly. These answers decide what it
looks like.

23. **Who will actually update this?** Names or roles, and roughly how many
    people.
24. **How comfortable are they with software?** Honestly. A tool built for a
    confident user and a tool built for someone who edits once a season are
    different tools.
25. **Does anything need approval before it goes live?** If so, who approves,
    and should the tool enforce that — an editor prepares, an approver
    publishes?
26. **Do you need to see a change before it goes live** (a preview), or is
    editing and publishing in one step fine?
27. **Does anyone need to undo a change** after it has published?
28. **Will anyone edit from a phone**, or is a desk computer safe to assume?

## 7. The display in the building

The app has a full-screen mode that loops through the stops for an unattended
screen.

29. **Do you want this, and where would it run?** Recruiting office, Lawton
    Room, somewhere else?
30. **What hardware?** A TV with a built-in browser, a laptop, a touchscreen?
31. **Is it unattended and always on**, or does someone start it?

## 8. Privacy and access — *needs a decision before real recruit names are used*

Today, a recruit's schedule opens from a link like
`…/?g=2026-09-05-alabama`. Anyone who has or guesses that link can read that
schedule. Nothing personal is stored in it — no names, no contact details.

32. **Is a visit schedule sensitive?** Would it be a problem if someone outside
    LSU could read it?
33. **Should the app greet a recruit by name?** It can, from the link, and the
    name is never stored — but it does appear in the address bar of their
    browser.
34. **Do you need to know who opened the app and when?** That is buildable, but
    it changes what we collect and requires a decision about what we keep.

    Depending on the answers, there are three levels: public links as now,
    private links that expire, or staff logins with per-recruit accounts. They
    are increasingly private and increasingly expensive. We would recommend the
    middle option if privacy matters at all, and we do not recommend making
    recruits create accounts.

35. **Please check this with your compliance office.** We are not able to advise
    on NCAA rules, but a digital recruiting experience showing a personalised
    itinerary may fall under recruiting-communication regulations. Better asked
    now than after it is in use.

## 9. Branding and approval

36. **Is there an LSU brand guide we should be following?** Colours, fonts,
    logo use.
37. **Who signs off on the visual design and the wording?**
38. **Can we have the correct logo files?** The app currently references a logo
    that does not exist and quietly hides it.

## 10. Timing

39. **When would you like this used for a real visit?**
40. **Is there a gameday we should be aiming at?**

---

## What happens with your answers

| You give us | We can then |
|---|---|
| §1–3 | Put a real gameday in front of a real recruit |
| §4–5 | Replace the placeholder images and decide the immersive tour's future |
| §6 | Build the editing tool so staff stop needing a developer |
| §8 | Choose the privacy model — this decides the whole back-end |
| §9 | Get the design approved |

**Until §1–3 arrive, the app runs on invented content.** It works, and it
demonstrates well, but nothing in it is true.

---

## One thing we would like to watch

If it is possible, we would like to observe a real gameday visit — or talk to
whoever runs one. Half an hour with the person who actually walks families from
the bus to the Lawton Room will tell us more than this entire questionnaire.
The most useful thing we can learn is what goes wrong: what families ask, where
they get lost, what staff end up repeating all day. That is what the app should
be fixing.
