import * as Plotly from "plotly.js-dist";
const interact = require("interactjs");

export function eventNameMap(streams: Object): Map<number, string> {
  const m = new Map<number, string>();
  Object.keys(streams).forEach((stream) => {
    Object.keys(streams[stream]).forEach((event) => {
      m.set(streams[stream][event], event);
    });
  });
  return m;
}

export function resize(e: string) {
  const el = document.getElementById(e);
  interact(el).resizable({
    edges: { left: false, right: false, bottom: true, top: true },
    listeners: {
      move(event) {
        var target = event.target;
        var x = 0;
        var y = 0;

        // update the element's style
        target.style.width = event.rect.width + "px";
        target.style.height = event.rect.height + "px";

        Plotly.relayout(el, { height: event.rect.height });

        // translate when resizing from top or left edges
        x += event.deltaRect.left;
        y += event.deltaRect.top;

        target.style.webkitTransform = target.style.transform =
          "translate(" + x + "px," + y + "px)";
      },
    },
  });
}
