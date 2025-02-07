import { FileDown } from "lucide-react"

export default function PDFExport() {
  return (
    <div className="mt-4">
      <button className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 flex items-center justify-center transition duration-300 ease-in-out transform hover:scale-105">
        <FileDown size={24} className="mr-2" />
        导出PDF
      </button>
    </div>
  )
}

