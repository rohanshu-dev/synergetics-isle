

//------------------------------------------------------------------------
//------------------------------------------------------------------------
// PROBLEM:
// Anchor links via URLs would take to a destination way below the target header.
// This is the default Quartz behavior confirmed from the documentation website.
//
// The order of the solutions is from bottom 1st and top last.
//
//------------------------------------------------------------------------
//------------------------------------------------------------------------



// Waits for font to load, then flash-snaps to target, I think ti works --

document.addEventListener("nav", () => {
  if (window.location.hash) {
    const id = decodeURIComponent(window.location.hash.slice(1))
    const el = document.getElementById(id)
    if (!el) return

    document.documentElement.style.visibility = "hidden"
    document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "smooth" })
          document.documentElement.style.visibility = ""
        })
      })
    })
  }
})

// -----------------------------------------------------------------------


// A + B ahead and then correct  ----------------------
// well now the it's kind of one part but actually still two part. previously it was A + B. where A was a small amount of initial scroll and then B where would take you to destination. Now, A takes you AHEAD of the target, and B snaps it back to the target header.
//-----------------------------------------------------
// document.addEventListener("nav", () => {
//   const hash = window.location.hash;
//   if (!hash) return;

//   const id = decodeURIComponent(hash.slice(1));
//   const el = document.getElementById(id);
//   if (!el) return;

//   // Wait for fonts to avoid layout shift, but don't hide the whole page
//   document.fonts.ready.then(() => {
//     requestAnimationFrame(() => {
//       el.scrollIntoView({ behavior: "instant" });
//     });
//   });
// });


// One part scroll with screen blank  ------------------
// A + B + C
// A is not a scroll but before-scroll state (milliseconds)
// B is the screen going blank to hide below attempt's 'A', and it does (milliseconds)
// C takes you to your destination (below step's B)
//-----------------------------------------------------
// document.addEventListener("nav", () => {
//   if (window.location.hash) {
//     const id = decodeURIComponent(window.location.hash.slice(1))
//     const el = document.getElementById(id)
//     if (!el) return
//     document.documentElement.style.visibility = "hidden"
//     document.fonts.ready.then(() => {
//       el.scrollIntoView({ behavior: "instant" })
//       document.documentElement.style.visibility = ""
//     })
//   }
// })


// Two part scroll ------------------------------------
// A + B 
// A is an initial scroll a few pixels down happening in a millisecond,
// B takes you to your destination
//-----------------------------------------------------
// document.addEventListener("nav", () => {
//   if (window.location.hash) {
//     const id = decodeURIComponent(window.location.hash.slice(1))
//     history.replaceState(null, "", window.location.pathname) // strip hash before browser jumps
//     document.fonts.ready.then(() => {
//       const el = document.getElementById(id)
//       el?.scrollIntoView({ behavior: "smooth" })
//       history.replaceState(null, "", "#" + id) // restore hash after scroll
//     })
//   }
// })


//------------------------------------------------------------------------
//------------------------------------------------------------------------

document.addEventListener("nav", () => {
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[role="anchor"]')

  anchors.forEach((anchor) => {
    const svg = anchor.querySelector('svg')
    if (!svg) return

    const originalPaths = svg.innerHTML
    const originalStroke = svg.getAttribute("stroke") || "currentColor"
    const checkmarkPath = `<polyline points="20 6 9 17 4 12"></polyline>`

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const onClick = (e: MouseEvent) => {
      const href = anchor.getAttribute("href")
      if (!href || !href.startsWith("#")) return

      e.preventDefault()
      e.stopPropagation()

      const url = window.location.origin + window.location.pathname + href

      navigator.clipboard.writeText(url).then(() => {
        if (timeoutId) clearTimeout(timeoutId)

        // 1. Swap icon content to tick
        svg.innerHTML = checkmarkPath

        // 2. Force visibility and "lock" it
        anchor.style.setProperty("opacity", "1", "important")
        anchor.style.setProperty("visibility", "visible", "important")
        anchor.style.setProperty("pointer-events", "none", "important")
        svg.style.setProperty("stroke", "var(--secondary)", "important")

        // 3. Start the exit sequence after 2 seconds
        timeoutId = setTimeout(() => {

          // A. Force the element to fade out while it's still a tick
          anchor.style.setProperty("opacity", "0", "important")
          anchor.style.setProperty("transition", "opacity 0.3s ease", "important")

          // B. Wait for that 0.3s fade to finish before swapping back
          setTimeout(() => {
            svg.innerHTML = originalPaths

            // C. Clean up all temporary styles
            anchor.style.removeProperty("opacity")
            anchor.style.removeProperty("visibility")
            anchor.style.removeProperty("pointer-events")
            anchor.style.removeProperty("transition")
            svg.style.removeProperty("stroke")

            svg.setAttribute("stroke", originalStroke)
            timeoutId = null
          }, 382) // Match the 0.3s transition

        }, 618)
      })
    }

    anchor.addEventListener("click", onClick)

    // @ts-ignore
    window.addCleanup(() => {
      if (timeoutId) clearTimeout(timeoutId)
      anchor.removeEventListener("click", onClick)
    })
  })
})