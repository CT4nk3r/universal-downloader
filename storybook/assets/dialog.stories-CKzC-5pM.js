import{j as n}from"./jsx-runtime-DFAAy_2V.js";import{r}from"./index-Bc2G9s8g.js";import{c as u}from"./cn-BLSKlp9E.js";import{B as c}from"./button-9wX7oT0w.js";import"./index-EXTQMK5R.js";const s=r.forwardRef(({open:t,onClose:a,className:D,children:_,...x},h)=>{const o=r.useRef(null);r.useImperativeHandle(h,()=>o.current,[]),r.useEffect(()=>{const e=o.current;e&&(t&&!e.open?typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""):!t&&e.open&&e.close())},[t]);const l=r.useCallback(e=>{e.preventDefault(),a()},[a]);return r.useEffect(()=>{const e=o.current;if(e)return e.addEventListener("cancel",l),()=>e.removeEventListener("cancel",l)},[l]),n.jsx("dialog",{ref:o,onClick:e=>{e.target===o.current&&a()},className:u("rounded-lg border border-[rgb(var(--ud-border))] bg-[rgb(var(--ud-bg))] p-0 text-[rgb(var(--ud-fg))] shadow-xl backdrop:bg-black/50","open:animate-in open:fade-in-0",D),...x,children:n.jsx("div",{className:"p-6",children:_})})});s.displayName="Dialog";function d({children:t,className:a}){return n.jsx("h2",{className:u("mb-2 text-lg font-semibold",a),children:t})}function p({children:t,className:a}){return n.jsx("p",{className:u("mb-4 text-sm text-[rgb(var(--ud-muted-fg))]",a),children:t})}try{d.displayName="DialogTitle",d.__docgenInfo={description:"",displayName:"DialogTitle",props:{className:{defaultValue:null,description:"",name:"className",required:!1,type:{name:"string"}}}}}catch{}try{p.displayName="DialogDescription",p.__docgenInfo={description:"",displayName:"DialogDescription",props:{className:{defaultValue:null,description:"",name:"className",required:!1,type:{name:"string"}}}}}catch{}try{s.displayName="Dialog",s.__docgenInfo={description:"",displayName:"Dialog",props:{open:{defaultValue:null,description:"",name:"open",required:!0,type:{name:"boolean"}},onClose:{defaultValue:null,description:"",name:"onClose",required:!0,type:{name:"() => void"}}}}}catch{}const C={title:"Components/Dialog",component:s},i={render:()=>{const[t,a]=r.useState(!1);return n.jsxs(n.Fragment,{children:[n.jsx(c,{onClick:()=>a(!0),children:"Open dialog"}),n.jsxs(s,{open:t,onClose:()=>a(!1),children:[n.jsx(d,{children:"Confirm action"}),n.jsx(p,{children:"This action cannot be undone."}),n.jsxs("div",{className:"flex justify-end gap-2",children:[n.jsx(c,{variant:"ghost",onClick:()=>a(!1),children:"Cancel"}),n.jsx(c,{variant:"destructive",onClick:()=>a(!1),children:"Delete"})]})]})]})}};var f,m,g;i.parameters={...i.parameters,docs:{...(f=i.parameters)==null?void 0:f.docs,source:{originalSource:`{
  render: () => {
    const [open, setOpen] = useState(false);
    return <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>
              Delete
            </Button>
          </div>
        </Dialog>
      </>;
  }
}`,...(g=(m=i.parameters)==null?void 0:m.docs)==null?void 0:g.source}}};const k=["Default"];export{i as Default,k as __namedExportsOrder,C as default};
