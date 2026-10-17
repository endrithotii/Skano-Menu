// What customers see when the restaurant hasn't added a menu yet (new restaurant, empty menu tree, no PDF / photos)

export function NoMenuYet({ name }: { name?: string | null }) {
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-white text-center px-6" data-no-menu>
      {name && <h1 className="text-lg font-semibold text-gray-900 mb-2">{name}</h1>}
      <p className="text-gray-500">No menu uploaded yet.</p>
    </main>
  );
}
