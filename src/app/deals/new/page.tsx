import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function NewDealPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New deal</h1>
        <p className="text-sm text-neutral-500">
          Upload whatever you have — contracts, a call transcript, corporate registration
          documents. The extraction agent reads unstructured files directly; there&apos;s no
          required format.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadDropzone />
        </CardContent>
      </Card>
    </div>
  );
}
