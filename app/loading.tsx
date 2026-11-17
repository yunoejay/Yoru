import SeriesSkeletonGrid from '../components/SeriesSkeletonGrid';

export default function Loading() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-3">
        <div className="skeleton h-6 w-28 rounded-full" />
        <div className="skeleton h-10 w-72" />
        <div className="skeleton h-5 w-96 max-w-full" />
      </div>
      <SeriesSkeletonGrid />
    </div>
  );
}
