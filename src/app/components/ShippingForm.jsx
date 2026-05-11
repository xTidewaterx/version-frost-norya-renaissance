'use client';

import { useState } from 'react';

export default function ShippingForm() {

  //we create the correct object structure for the form data that we will send to the backend, and we initialize it with empty values. We also set the default sender country to Norway since we are only shipping from Norway.
  const [formData, setFormData] = useState({
    senderName: '',
    senderAddress: '',
    senderCity: '',
    senderPostalCode: '',
    senderCountry: 'Norway',
    recipientName: '',
    recipientAddress: '',
    recipientCity: '',
    recipientPostalCode: '',
    recipientCountry: '',
    packageWeight: '',
    packageLength: '',
    packageWidth: '',
    packageHeight: '',
    productType: 'standard',
  });

  const [status, setStatus] = useState('');
  const [response, setResponse] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setResponse(null);

    try {
      const res = await fetch('/api/shipping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setResponse(data);
        console.log(data, "from backend post request endpoint handler");
      } else {
        setStatus('error');
        setResponse(data);
      }
    } catch (err) {
      setStatus('error');
      setResponse({ error: 'Network error', details: err.message });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-blue-950 px-8 py-6">
            <h1 className="text-2xl font-bold text-white">Shipping Request</h1>
            <p className="text-blue-200 mt-1">
              Enter shipping details to request a Norway Bring product
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Sender Section */}
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                Sender Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="senderName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="senderName"
                    name="senderName"
                    value={formData.senderName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label
                    htmlFor="senderCountry"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Country
                  </label>
                  <input
                    type="text"
                    id="senderCountry"
                    name="senderCountry"
                    value={formData.senderCountry}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-100"
                    placeholder="Norway"
                    readOnly
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="senderAddress"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Street Address
                  </label>
                  <input
                    type="text"
                    id="senderAddress"
                    name="senderAddress"
                    value={formData.senderAddress}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Street Address 123"
                  />
                </div>
                <div>
                  <label
                    htmlFor="senderCity"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    City
                  </label>
                  <input
                    type="text"
                    id="senderCity"
                    name="senderCity"
                    value={formData.senderCity}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Oslo"
                  />
                </div>
                <div>
                  <label
                    htmlFor="senderPostalCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Postal Code
                  </label>
                  <input
                    type="text"
                    id="senderPostalCode"
                    name="senderPostalCode"
                    value={formData.senderPostalCode}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="0150"
                  />
                </div>
              </div>
            </section>

            {/* Recipient Section */}
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                Recipient Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="recipientName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="recipientName"
                    name="recipientName"
                    value={formData.recipientName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label
                    htmlFor="recipientCountry"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Country
                  </label>
                  <input
                    type="text"
                    id="recipientCountry"
                    name="recipientCountry"
                    value={formData.recipientCountry}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Sweden"
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="recipientAddress"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Street Address
                  </label>
                  <input
                    type="text"
                    id="recipientAddress"
                    name="recipientAddress"
                    value={formData.recipientAddress}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Street Address 456"
                  />
                </div>
                <div>
                  <label
                    htmlFor="recipientCity"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    City
                  </label>
                  <input
                    type="text"
                    id="recipientCity"
                    name="recipientCity"
                    value={formData.recipientCity}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Stockholm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="recipientPostalCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Postal Code
                  </label>
                  <input
                    type="text"
                    id="recipientPostalCode"
                    name="recipientPostalCode"
                    value={formData.recipientPostalCode}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="111 27"
                  />
                </div>
              </div>
            </section>

            {/* Package Section */}
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                Package Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="packageWeight"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="packageWeight"
                    name="packageWeight"
                    value={formData.packageWeight}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="2.5"
                  />
                </div>
                <div>
                  <label
                    htmlFor="productType"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Product Type
                  </label>
                  <select
                    id="productType"
                    name="productType"
                    value={formData.productType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  >
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                    <option value="fragile">Fragile</option>
                    <option value="oversized">Oversized</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="packageLength"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Length (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    id="packageLength"
                    name="packageLength"
                    value={formData.packageLength}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="packageWidth"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Width (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    id="packageWidth"
                    name="packageWidth"
                    value={formData.packageWidth}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="packageHeight"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    id="packageHeight"
                    name="packageHeight"
                    value={formData.packageHeight}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="10"
                  />
                </div>
              </div>
            </section>

            {/* Status & Response */}
            {status && (
              <div
                  className={`p-4 rounded-lg ${
                    status === 'sending'
                      ? 'bg-blue-900 text-blue-100'
                      : status === 'success'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
              >
                <p className="font-medium">
                  {status === 'sending'
                    ? 'Sending request...'
                    : status === 'success'
                    ? 'Request sent successfully!'
                    : 'Error sending request'}
                </p>
              </div>
            )}

            {response && (
              <div className="bg-gray-50 rounded-lg p-4 overflow-auto">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Response:
                </h3>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === 'sending'}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition shadow-md ${
                status === 'sending'
                  ? 'bg-blue-800 cursor-not-allowed'
                  : 'bg-blue-950 hover:bg-blue-900 active:scale-[0.98]'
              }`}
            >
              {status === 'sending' ? 'Sending...' : 'Send Shipping Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
