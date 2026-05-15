import * as React from "react";

function Table({ ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table {...props} />;
}

function TableHeader({ ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

function TableBody({ ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

function TableFooter({ ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot {...props} />;
}

function TableRow({ ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />;
}

function TableHead({ ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} />;
}

function TableCell({ ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />;
}

function TableCaption({ ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption {...props} />;
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
