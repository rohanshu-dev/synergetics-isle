---
draft: "true"
---
# To do
- [ ] try to already get the side bar contents in order. go from whole to less!
- [ ] get stuff from ticktick to here or otherwise
- [ ] $this$ kind of usage of dollar signs make equations cool
- [ ] "next" and "previous" as actual properties might be cool to have
- [ ] If someone searches a figure which has both a png file and an actual page file with description of the image, then he may stumble on the image file first which would be bad. So such files can be added a suffix or a prefix to then somehow hide it from search queries.
- [ ] for a link "figure xyz" or "section xyz", only xyz is 'linked-ed' in most places. I think having the whole thing in brackets would be cleaner to look at. THIS IS ONLY POSSIBLE FOR SINGULARS. like if it is "secs. 123 and 345", then only numbers shall have linked appearance
- [ ] global search "rwgray" or something to make sure you haven't pulled a link from the website
- [ ] make sure to admit somewhere that some images, like those above chapters haven't been included - they can be, later, if deemed important
- [ ] in 901.00, 1/2 was found written as 'l/2' so it is possible that '1' is written as 'l' in a lot of places. it is so in the html as well.
- [ ] mind this "`" symbol... it does this...
- [ ] scenarios are mentioned inline, organize it as per new implementations
- [ ] Fig. 966.05 already had another version of it, so skim through the figures list to catch duplicates (i kind of already added linked images for chapters i did initially, then was adding them again while doing the chapters themselves. this pattern will be there till i decided to do links later)
- [ ] Fig. vs "Fig" (without the dot) - some titles dont have the dot
- [ ] em dash need spaces around them to prevent weird rendering of italics and such. need to first replace those with space with no space and then collectively give one space for every em dash globally
- [ ] em dahes are used for lists in a lot of places, might need to use actual lists
- [ ] im using short forms DSR, RWGS (rwgray's synergetics) here and there, might be worth documenting those properly
- [ ] "See Secs. [[954.20]]-.70." in here i only linked the half before the dash, somewhere else i linked the whole.
- [ ] so i need to remove all br tags as inline breaks will now be recognized (there was a built in plugin for turning the same on)
- [ ] explorer lists stops responding to mouse when the context is an open folder rather than the explorer


# Corrections made here
- 930.20 image isn't anywhere, it had a lame version in buckyverse.org so i added it

# Superscript table

| Number | Subscript | Superscript |
| ------ | --------- | ----------- |
| Zero   | ₀         | ⁰           |
| One    | ₁         | ¹           |
| Two    | ₂         | ²           |
| Three  | ₃         | ³           |
| Four   | ₄         | ⁴           |
| Five   | ₅         | ⁵           |
| Six    | ₆         | ⁶           |
| Seven  | ₇         | ⁷           |
| Eight  | ₈         | ⁸           |
| Nine   | ₉         | ⁹           |

π
—
→

Code to highlight italics in browser (put in DevTools console):
```
	$$('i, em, .italic, [style*="font-style: italic"]').forEach(el => el.style.backgroundColor = 'yellow'); 
```


To highlight figures and equal to signs
```

(function highlightNumbersAndEquals() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    
    while (walker.nextNode()) {
        const parentTag = walker.currentNode.parentElement.tagName;
        if (parentTag !== 'SCRIPT' && parentTag !== 'STYLE' && parentTag !== 'TEXTAREA') {
            nodes.push(walker.currentNode);
        }
    }

    nodes.forEach(node => {
        const parent = node.parentNode;
        if (!parent) return;

        const text = node.nodeValue;
        // Updated Regex: Matches digits (\d+) OR the equal sign (=)
        const targetRegex = /(\d+|=)/g;

        if (targetRegex.test(text)) {
            const span = document.createElement('span');
            span.innerHTML = text.replace(targetRegex, 
                '<span style="background-color: red !important; color: white !important; font-weight: bold !important; padding: 0 2px; border-radius: 2px;">$1</span>'
            );
            parent.replaceChild(span, node);
        }
    });
})();
```
To highlight superscripts

```
(function() {
  const superscripts = document.querySelectorAll('sup');
  
  superscripts.forEach(el => {
    el.style.backgroundColor = 'yellow';
    el.style.border = '1px solid red';
    el.style.borderRadius = '2px';
    el.style.padding = '1px';
  });

  console.log(`Highlighted ${superscripts.length} total superscripts.`);
})();
```


---
# Rules
All the main headings are now their own pages.
All sub headings are H1s.
All H1s are headings only, with no content. And probably will have a round number thing going on.
Currently used headings are only: H1, H5, bold
"img 1072.21" implies text captured as an image


# Problems I'm facing

Heading Repetition is when say 222 is repeated as again as 222-Heading so the heading captures the stuff below it as well. there are a few inconsistencies with this in the book itself. 

index from rwgrey website contains boldened-only 'headings' as well, but thats not how headings work in markdown. so if we make h5 into h3, it will render, but either we'll have to repeat a heading so as to also have a normal figure-only heading for easy URLs, or we will have to keep the single heading which will contain both the number and the heading title instead of in-paragraph-bolding.

main: the tocs in synergetics-online are not fully in line with the actual text's arrangements of headings, leading to come inconsistences which I've tried to modify and keep a record of.

100.010 and 100.020 are headings in the PDF ToC, but are lower level headings in text itself. Making me repeat the in-line titles as higher level headers. 

240.00, 250.00, 260.00, 2 are shown as indented headers but are round figures so I have treated them as main headings

251.00 is higher level heading (even in the actual text, it is same level has H1) than its neighbors but i tread it as part of 250.

264.10 is indented in toc but in text has H1 respect, will go with H1

1224.00 is supposed to be H5, but is just a heading with no content. It also directly follows a legit H1. 
1238.60 70, 80 are H5 in index but need to be 

In Omnitopology, a lot of chapters were arranged in PDF's toc as if they're not chapters, so I had them separate out properly


419.30 is a inline heading and not a heading by itself but it needs to be h1 as per toc. but as it is not a checkpoint heading, i will not make it so

## Changes
Fig. 1009.57A is written to be Fig. 1009.75A. I corrected it.






# Pitch
Everything will be at one place, updatable in a matter of seconds. Casey's infographic can be embeded here as well.


# Features
- Beautiful on all devices small or big
- Open source
- One click link copying
- Faster search than any PDF
- In-built AI
- Prospects of "3D" and interactive animations: sample
