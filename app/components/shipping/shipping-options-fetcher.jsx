'use client'

import React, { useState } from 'react'

export default function ShippingOptionsFetcher() {
  const [status, setStatus] = useState('')

  async function handleSubmit(event) {
    event.preventDefault() // Prevents the page from reloading
    setStatus('Sending...')

    try {
      const response = await fetch('/api/my-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: 'John Doe',
          role: 'Developer' 
        }),
      })

      if (!response.ok) {
        throw new Error('Network response failed')
      }

      const data = await response.json()
      setStatus('Success! Data sent.')
      console.log('Server response:', data)
      
    } catch (error) {
      setStatus('Error sending data')
      console.error(error)
    }
  }

  return (
    <div className="p-4">
      <button 
        onClick={handleSubmit}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Send POST Request
      </button>
      <p className="mt-2 text-sm">{status}</p>
    </div>
  )
}
