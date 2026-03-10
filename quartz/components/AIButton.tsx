import styles from "./styles/aibutton.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const AIButton: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <a href="/synergetics-ai" class={classNames(displayClass, "ai-button")} aria-label="Chat with AI">
      <span class="ai-pill">AI</span>
    </a>
  )
}

AIButton.css = styles

export default (() => AIButton) satisfies QuartzComponentConstructor