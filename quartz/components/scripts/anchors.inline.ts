

const svgCheck = `<polyline points="20 6 9 17 4 12"></polyline>`

export function attachAnchorListeners(container: HTMLElement | Document, pageSlug?: string) {
  const anchors = container.querySelectorAll<HTMLAnchorElement>('a[role="anchor"]')

  anchors.forEach((anchor) => {
    const svg = anchor.querySelector("svg")
    if (!svg) return

    const originalPaths = svg.innerHTML
    const originalStroke = svg.getAttribute("stroke") || "currentColor"
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const onClick = (e: Event) => {
      const href = anchor.getAttribute("href")
      if (!href || !href.startsWith("#")) return
      e.preventDefault()
      e.stopPropagation()

      const path = pageSlug ? "/" + pageSlug : window.location.pathname
      const url = window.location.origin + path + href

      navigator.clipboard.writeText(url).then(() => {
        if (timeoutId) clearTimeout(timeoutId)

        svg.innerHTML = svgCheck
        anchor.style.setProperty("opacity", "1", "important")
        anchor.style.setProperty("visibility", "visible", "important")
        anchor.style.setProperty("pointer-events", "none", "important")
        svg.style.setProperty("stroke", "var(--secondary)", "important")

        timeoutId = setTimeout(() => {
          anchor.style.setProperty("opacity", "0", "important")
          anchor.style.setProperty("transition", "opacity 0.3s ease", "important")

          setTimeout(() => {
            svg.innerHTML = originalPaths
            anchor.style.removeProperty("opacity")
            anchor.style.removeProperty("visibility")
            anchor.style.removeProperty("pointer-events")
            anchor.style.removeProperty("transition")
            svg.style.removeProperty("stroke")
            svg.setAttribute("stroke", originalStroke)
            timeoutId = null
          }, 382)
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
}

document.addEventListener("nav", () => {
  if (window.location.hash) {
    const id = decodeURIComponent(window.location.hash.slice(1))
    const el = document.getElementById(id)
    if (!el) return

    // Prevent browser's instant jump
    const scrollPos = window.scrollY
    document.documentElement.style.visibility = "hidden"

    document.fonts.ready.then(() => {
      // Restore scroll position browser may have jumped to
      window.scrollTo(0, scrollPos)

      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth" })
        document.documentElement.style.visibility = ""
      })
    })
  }

  attachAnchorListeners(document)
})

// //------------------------------------------------------------------------
// //------------------------------------------------------------------------
// // PROBLEM:
// // Anchor links via URLs would take to a destination way below the target header.
// // This is the default Quartz behavior confirmed from the documentation website.
// //
// // The order of the solutions is from bottom 1st and top last.
// //
// //------------------------------------------------------------------------
// //------------------------------------------------------------------------



// // Waits for font to load, then flash-snaps to target, I think ti works --

// document.addEventListener("nav", () => {
//   if (window.location.hash) {
//     const id = decodeURIComponent(window.location.hash.slice(1))
//     const el = document.getElementById(id)
//     if (!el) return

//     document.documentElement.style.visibility = "hidden"
//     document.fonts.ready.then(() => {
//       requestAnimationFrame(() => {
//         requestAnimationFrame(() => {
//           el.scrollIntoView({ behavior: "smooth" })
//           document.documentElement.style.visibility = ""
//         })
//       })
//     })
//   }
// })

// // -----------------------------------------------------------------------


// // A + B ahead and then correct  ----------------------
// // well now the it's kind of one part but actually still two part. previously it was A + B. where A was a small amount of initial scroll and then B where would take you to destination. Now, A takes you AHEAD of the target, and B snaps it back to the target header.
// //-----------------------------------------------------
// // document.addEventListener("nav", () => {
// //   const hash = window.location.hash;
// //   if (!hash) return;

// //   const id = decodeURIComponent(hash.slice(1));
// //   const el = document.getElementById(id);
// //   if (!el) return;

// //   // Wait for fonts to avoid layout shift, but don't hide the whole page
// //   document.fonts.ready.then(() => {
// //     requestAnimationFrame(() => {
// //       el.scrollIntoView({ behavior: "instant" });
// //     });
// //   });
// // });


// // One part scroll with screen blank  ------------------
// // A + B + C
// // A is not a scroll but before-scroll state (milliseconds)
// // B is the screen going blank to hide below attempt's 'A', and it does (milliseconds)
// // C takes you to your destination (below step's B)
// //-----------------------------------------------------
// // document.addEventListener("nav", () => {
// //   if (window.location.hash) {
// //     const id = decodeURIComponent(window.location.hash.slice(1))
// //     const el = document.getElementById(id)
// //     if (!el) return
// //     document.documentElement.style.visibility = "hidden"
// //     document.fonts.ready.then(() => {
// //       el.scrollIntoView({ behavior: "instant" })
// //       document.documentElement.style.visibility = ""
// //     })
// //   }
// // })


// // Two part scroll ------------------------------------
// // A + B 
// // A is an initial scroll a few pixels down happening in a millisecond,
// // B takes you to your destination
// //-----------------------------------------------------
// // document.addEventListener("nav", () => {
// //   if (window.location.hash) {
// //     const id = decodeURIComponent(window.location.hash.slice(1))
// //     history.replaceState(null, "", window.location.pathname) // strip hash before browser jumps
// //     document.fonts.ready.then(() => {
// //       const el = document.getElementById(id)
// //       el?.scrollIntoView({ behavior: "smooth" })
// //       history.replaceState(null, "", "#" + id) // restore hash after scroll
// //     })
// //   }
// // })


// //------------------------------------------------------------------------
// //------------------------------------------------------------------------

// document.addEventListener("nav", () => {
//   const anchors = document.querySelectorAll<HTMLAnchorElement>('a[role="anchor"]')

//   anchors.forEach((anchor) => {
//     const svg = anchor.querySelector('svg')
//     if (!svg) return

//     const originalPaths = svg.innerHTML
//     const originalStroke = svg.getAttribute("stroke") || "currentColor"
//     const checkmarkPath = `<polyline points="20 6 9 17 4 12"></polyline>`

//     let timeoutId: ReturnType<typeof setTimeout> | null = null

//     const onClick = (e: MouseEvent) => {
//       const href = anchor.getAttribute("href")
//       if (!href || !href.startsWith("#")) return

//       e.preventDefault()
//       e.stopPropagation()

//       const url = window.location.origin + window.location.pathname + href

//       navigator.clipboard.writeText(url).then(() => {
//         if (timeoutId) clearTimeout(timeoutId)

//         // 1. Swap icon content to tick
//         svg.innerHTML = checkmarkPath

//         // 2. Force visibility and "lock" it
//         anchor.style.setProperty("opacity", "1", "important")
//         anchor.style.setProperty("visibility", "visible", "important")
//         anchor.style.setProperty("pointer-events", "none", "important")
//         svg.style.setProperty("stroke", "var(--secondary)", "important")

//         // 3. Start the exit sequence after 2 seconds
//         timeoutId = setTimeout(() => {

//           // A. Force the element to fade out while it's still a tick
//           anchor.style.setProperty("opacity", "0", "important")
//           anchor.style.setProperty("transition", "opacity 0.3s ease", "important")

//           // B. Wait for that 0.3s fade to finish before swapping back
//           setTimeout(() => {
//             svg.innerHTML = originalPaths

//             // C. Clean up all temporary styles
//             anchor.style.removeProperty("opacity")
//             anchor.style.removeProperty("visibility")
//             anchor.style.removeProperty("pointer-events")
//             anchor.style.removeProperty("transition")
//             svg.style.removeProperty("stroke")

//             svg.setAttribute("stroke", originalStroke)
//             timeoutId = null
//           }, 382) // Match the 0.3s transition

//         }, 618)
//       })
//     }

//     anchor.addEventListener("click", onClick)

//     // @ts-ignore
//     window.addCleanup(() => {
//       if (timeoutId) clearTimeout(timeoutId)
//       anchor.removeEventListener("click", onClick)
//     })
//   })
// })

// // ----------------------------------------------------------------------------------
// // For the anchor to work as a copy button also in the preview panel
// // ----------------------------------------------------------------------------------

// const svgCheck =
//   '<svg aria-hidden="true" height="18" viewBox="0 0 16 16" width="18"><path fill-rule="evenodd" fill="currentColor" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>'

// export function attachAnchorListeners(container: HTMLElement | Document, pageSlug?: string) {
//   container.querySelectorAll('a[role="anchor"]').forEach((anchor) => {
//     const svgLink = anchor.innerHTML
//     function onClick(e: Event) {
//       e.preventDefault()
//       e.stopPropagation()  // fixes problem 2 — stops scroll behavior
//       const heading = anchor.closest("h1, h2, h3, h4, h5, h6")
//       const id = heading?.id
//       if (!id) return
//       const path = pageSlug ? "/" + pageSlug : window.location.pathname
//       const url = window.location.origin + path + "#" + id
//       navigator.clipboard.writeText(url).then(() => {
//         anchor.innerHTML = svgCheck
//         anchor.classList.add("copied")
//         setTimeout(() => {
//           anchor.innerHTML = svgLink
//           anchor.classList.remove("copied")
//         }, 2000)
//       })
//     }
//     anchor.addEventListener("click", onClick)
//     window.addCleanup(() => anchor.removeEventListener("click", onClick))
//   })
// }

// document.addEventListener("nav", () => {
//   attachAnchorListeners(document)
// })

// // ---------------------------------------------------------------------------